// The sprite bundle as the browser sees it: manifests fetched once, sprite sheets fetched
// and decoded on demand and kept for the session.

import { compose, cropFrame, layerImages, pickProvider, spritePath, type FrameSource } from './compose';
import { buildLayers, type Layer } from './humanoid';
import { decodePng } from './png';
import { speciesFor } from './species';
import type { ImageEntry, ItemsFile, Manifest, Pixels, Recipe, SpriteChoice } from './types';

export const BUNDLE_URL = (process.env.NEXT_PUBLIC_PORTRAIT_BUNDLE_URL ?? '/portrait-bundle').replace(/\/$/, '');

export class BrowserBundle {
    items: ItemsFile | null = null;
    private sheets = new Map<string, Promise<Pixels | null>>();
    private ready = new Map<string, Pixels | null>();
    private itemsLoading: Promise<ItemsFile> | null = null;

    private constructor(readonly manifest: Manifest) {}

    static async load(): Promise<BrowserBundle> {
        const res = await fetch(`${BUNDLE_URL}/manifest.json`);
        if (!res.ok) throw new Error(`No sprite bundle at ${BUNDLE_URL} (${res.status}). Build one with portrait-extract/extract.py.`);
        return new BrowserBundle(await res.json());
    }

    /** The clothing index is large; it loads the first time something needs it. */
    loadItems(): Promise<ItemsFile> {
        this.itemsLoading ??= fetch(`${BUNDLE_URL}/items.json?v=${this.manifest.build}`)
            .then((res) => res.json())
            .then((items: ItemsFile) => (this.items = items));
        return this.itemsLoading;
    }

    entry(image: string): ImageEntry | undefined {
        return this.manifest.images[image] ?? this.items?.images[image];
    }

    private sheet(image: string, mod: string): Promise<Pixels | null> {
        const key = `${mod}${image}`;
        let pending = this.sheets.get(key);
        if (!pending) {
            pending = fetch(`${BUNDLE_URL}/${spritePath(mod, image)}?v=${this.manifest.build}`)
                .then(async (res) => (res.ok ? decodePng(new Uint8Array(await res.arrayBuffer())) : null))
                .catch(() => null)
                .then((px) => {
                    this.ready.set(key, px);
                    return px;
                });
            this.sheets.set(key, pending);
        }
        return pending;
    }

    /** One frame of an image (an item icon, say), fetching its sheet if need be. */
    async frame(image: string, frame: string | undefined, choice?: SpriteChoice): Promise<Pixels | null> {
        const entry = this.entry(image);
        const mod = pickProvider(entry, choice);
        const sheet = mod ? await this.sheet(image, mod) : null;
        if (!sheet) return null;
        const rect = entry?.f && frame ? this.manifest.frames[entry.f]?.[frame] : undefined;
        return rect ? cropFrame(sheet, rect) : sheet;
    }

    /** Whether a recipe with this choice of mods has the image at all. */
    has(image: string, choice: SpriteChoice): boolean {
        return pickProvider(this.entry(image), choice) !== null;
    }

    /** Fetch every sheet these layers use, from the mods the choice selects. */
    async preload(layers: Layer[], choice: SpriteChoice): Promise<void> {
        await Promise.all(
            layerImages(layers).map((image) => {
                const mod = pickProvider(this.entry(image), choice);
                return mod ? this.sheet(image, mod) : null;
            }),
        );
    }

    /** Synchronous view over the sheets already fetched. */
    source(choice: SpriteChoice): FrameSource {
        const image = (name: string) => {
            const mod = pickProvider(this.entry(name), choice);
            return mod ? this.ready.get(`${mod}${name}`) ?? null : null;
        };
        return {
            image,
            frame: (name, frame) => {
                const sheet = image(name);
                if (!sheet) return null;
                const frames = this.entry(name)?.f;
                if (!frames) return sheet;
                const rect = this.manifest.frames[frames]?.[frame];
                return rect ? cropFrame(sheet, rect) : null;
            },
        };
    }

    async render(recipe: Recipe): Promise<{ pixels: Pixels; layers: Layer[] }> {
        const dressed = !recipe.nude && Object.keys(recipe.wear).length > 0;
        const items = dressed ? await this.loadItems() : this.items ?? undefined;
        const layers = buildLayers(speciesFor(this.manifest, recipe.species, recipe.exclude), recipe, items);
        await this.preload(layers, recipe);
        return { pixels: compose(layers, this.source(recipe)), layers };
    }
}

/** Paint pixels onto a canvas at 1:1 (scale it up with CSS `image-rendering: pixelated`). */
export function paint(canvas: HTMLCanvasElement, pixels: Pixels): void {
    canvas.width = pixels.width;
    canvas.height = pixels.height;
    const image = new ImageData(pixels.width, pixels.height);
    image.data.set(pixels.data);
    canvas.getContext('2d')?.putImageData(image, 0, 0);
}

/** A PNG of the pixels, each one drawn `scale` screen pixels wide. */
export function toPngBlob(pixels: Pixels, scale = 1): Promise<Blob | null> {
    const small = document.createElement('canvas');
    paint(small, pixels);
    const out = document.createElement('canvas');
    out.width = pixels.width * scale;
    out.height = pixels.height * scale;
    const ctx = out.getContext('2d');
    if (!ctx) return Promise.resolve(null);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, out.width, out.height);
    return new Promise((resolve) => out.toBlob(resolve, 'image/png'));
}
