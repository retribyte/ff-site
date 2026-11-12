// The sprite bundle as the browser sees it: the mods' index files fetched once and merged,
// sprites fetched from each mod's pack as byte ranges, decoded on demand and kept for the session.

import { compose, cropFrame, layerImages, pickProvider, type FrameSource } from './compose';
import { curateItems, repairSheet } from './curation';
import { buildLayers, type Layer } from './humanoid';
import { locate, mergeItems, mergeMods } from './merge';
import { planRuns, slice, type Wanted } from './pack';
import { decodePng } from './png';
import { speciesFor } from './species';
import type { ImageEntry, ItemsFile, Manifest, ModFile, ModItemsFile, Pixels, Recipe, SpriteChoice } from './types';

export const BUNDLE_URL = (process.env.NEXT_PUBLIC_PORTRAIT_BUNDLE_URL ?? '/portrait-bundle').replace(/\/$/, '');
const PACK_NAME = 'sprites.pack';
/** How long to collect sprite requests before sending them, so a screenful goes out together. */
const BATCH_MS = 8;

type Deliver = (bytes: Uint8Array | null) => void;

export class BrowserBundle {
    items: ItemsFile | null = null;
    private sheets = new Map<string, Promise<Pixels | null>>();
    private ready = new Map<string, Pixels | null>();
    private itemsLoading: Promise<ItemsFile> | null = null;
    private queue = new Map<string, Wanted<Deliver>[]>();
    private flushing: ReturnType<typeof setTimeout> | null = null;
    /** Whole packs, for a server that ignores Range and sends the entire file. */
    private whole = new Map<string, Uint8Array>();

    private constructor(readonly manifest: Manifest) {}

    static async load(): Promise<BrowserBundle> {
        const res = await fetch(`${BUNDLE_URL}/mods.json`);
        if (!res.ok) throw new Error(`No sprite bundle at ${BUNDLE_URL} (${res.status}). Build one with portrait-extract/extract.py.`);
        const index: { mods: ModFile[] } = await res.json();
        return new BrowserBundle(mergeMods(index.mods));
    }

    /** The clothing index is large; it loads the first time something needs it. */
    loadItems(): Promise<ItemsFile> {
        this.itemsLoading ??= fetch(`${BUNDLE_URL}/items.json?v=${this.manifest.build}`)
            .then((res) => res.json())
            .then((index: { mods: ModItemsFile[] }) => (this.items = curateItems(mergeItems(index.mods, this.manifest))));
        return this.itemsLoading;
    }

    entry(image: string): ImageEntry | undefined {
        return this.manifest.images[image] ?? this.items?.images[image];
    }

    /** The bytes of one mod's copy of an image, fetched together with whatever else is wanted just now. */
    private bytes(mod: string, image: string): Promise<Uint8Array | null> {
        const ref = locate(mod, image, this.manifest, this.items);
        if (!ref) return Promise.resolve(null);
        return new Promise((resolve) => {
            const list = this.queue.get(mod) ?? [];
            list.push({ offset: ref[0], length: ref[1], for: resolve });
            this.queue.set(mod, list);
            this.flushing ??= setTimeout(() => this.flush(), BATCH_MS);
        });
    }

    private flush(): void {
        const queue = this.queue;
        this.queue = new Map();
        this.flushing = null;
        for (const [mod, wanted] of queue) {
            const whole = this.whole.get(mod);
            if (whole) {
                for (const item of wanted) item.for(slice(whole, 0, item));
                continue;
            }
            const url = `${BUNDLE_URL}/${encodeURIComponent(mod)}/${PACK_NAME}?v=${this.manifest.packs[mod]?.build ?? ''}`;
            for (const run of planRuns(wanted)) {
                fetch(url, { headers: { Range: `bytes=${run.start}-${run.end - 1}` } })
                    .then(async (res) => {
                        if (!res.ok) throw new Error(String(res.status));
                        const body = new Uint8Array(await res.arrayBuffer());
                        // 206: just the range asked for. 200: the server sent the whole pack.
                        const base = res.status === 206 ? run.start : 0;
                        if (res.status !== 206) this.whole.set(mod, body);
                        for (const item of run.items) item.for(slice(body, base, item));
                    })
                    .catch(() => run.items.forEach((item) => item.for(null)));
            }
        }
    }

    private sheet(image: string, mod: string): Promise<Pixels | null> {
        const key = `${mod}${image}`;
        let pending = this.sheets.get(key);
        if (!pending) {
            pending = this.bytes(mod, image)
                .then((bytes) => (bytes ? decodePng(bytes) : null))
                .catch(() => null)
                .then((px) => {
                    if (px) repairSheet(key, px);
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
