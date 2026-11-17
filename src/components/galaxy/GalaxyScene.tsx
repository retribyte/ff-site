'use client';

// The galaxy itself: three.js draws its shape, the territories and the sector grid;
// places are DOM markers projected on top each frame.

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ANDROMEDA_DIR, DISK_R, H, MAP_ROT, N, OCTS, PPK, REGIONS, RIM_CELLS, S, regionAt, sectorOf, starOf, STAR_TYPES } from './data';
import type { Place, Vec3 } from './data';
import styles from './galaxy.module.scss';

export type ViewMode = 'tilt' | 'top';
export interface Layers {
    /** The painted galaxy disc. */
    galaxy: boolean;
    /** GU, ADE and LR territory, with their names. */
    territories: boolean;
    /** Dim highlight over Outer Rim sectors. */
    rim: boolean;
    /** Plain sector grid on the plane. */
    grid: boolean;
    /** Colored octant slabs and octant names. */
    octants: boolean;
    /** Galactic bar and the way to Andromeda. */
    bearings: boolean;
    /** Names beside the place markers. */
    labels: boolean;
    /** The arms and the Bakree and Omega routes as colored transit lines. */
    transit: boolean;
}

interface Props {
    places: Place[];
    selectedId: number | null;
    onSelect: (id: number | null) => void;
    view: ViewMode;
    layers: Layers;
    /** When set, the next click on the map reports a position (top-down only). */
    placing: boolean;
    onPlace: (pos: Vec3) => void;
    /** Changing this number flies the camera to the selected place. */
    flyToken: number;
    /** Double-click on a marker. */
    onOpen?: (id: number) => void;
    /** Changing this number puts the camera back where it started. */
    resetToken?: number;
    /** Given to whoever may add: a click on empty space offers "+ Add here", and this takes the spot. */
    onAddAt?: (pos: Vec3) => void;
    /** How strongly the starfield shows behind the map, 0 to 1. */
    sky?: number;
    /** Called once when there is no WebGL and the still picture is shown instead. */
    onStill?: () => void;
    /** Something covers the whole map (the system view): nothing is drawn meanwhile. */
    paused?: boolean;
}

/**
 * The galaxy's shape as one soft painted disc (bulge, bar, four arms), not a
 * cloud of star points: dots read as places and bury the real markers.
 */
function buildGalaxy(): THREE.Group {
    const group = new THREE.Group();
    const size = 1024;
    const ext = DISK_R * 2.1;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    const k = size / ext;
    const px = (x: number) => (x / ext + 0.5) * size;
    const py = (y: number) => (0.5 - y / ext) * size;
    const blob = (x: number, y: number, r: number, rgb: string, alpha: number) => {
        const gr = g.createRadialGradient(px(x), py(y), 0, px(x), py(y), r * k);
        gr.addColorStop(0, `rgba(${rgb},${alpha})`);
        gr.addColorStop(1, `rgba(${rgb},0)`);
        g.fillStyle = gr;
        g.fillRect(px(x) - r * k, py(y) - r * k, 2 * r * k, 2 * r * k);
    };
    g.globalCompositeOperation = 'lighter';
    blob(0, 0, DISK_R, '120,140,200', 0.3);
    const tMax = Math.log(DISK_R / ARM_R0) / ARM_PITCH;
    for (const { off, major } of ARMS) {
        for (let n = 0; n <= 260; n++) {
            const [x, y, r] = armPoint(off, (n / 260) * tMax);
            const w = (2.2 + r / 12) * (major ? 1 : 0.75);
            blob(x, y, w, '150,185,255', (major ? 0.03 : 0.02) * (1 - (0.6 * n) / 260));
        }
    }
    // Bar along +y, then the bulge.
    for (let n = -24; n <= 24; n++) blob(0, (n / 24) * 12, 4.2 - Math.abs(n) / 12, '255,214,160', 0.035);
    blob(0, 0, 7, '255,222,170', 0.55);
    blob(0, 0, 3, '255,240,215', 0.6);
    // Fade out at the edge of the disk.
    g.globalCompositeOperation = 'destination-in';
    const mask = g.createRadialGradient(size / 2, size / 2, DISK_R * 0.86 * k, size / 2, size / 2, DISK_R * k);
    mask.addColorStop(0, 'rgba(0,0,0,1)');
    mask.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = mask;
    g.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(ext, ext), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    disc.position.z = -0.12;
    disc.renderOrder = -2;
    group.add(disc);
    // The galaxy's body: clouds of large soft puffs with real thickness, over the painted disc.
    const { light, dust } = galaxyClouds();
    // Named, because the live scene takes them out and draws them at half size (`cloudLayer`).
    const clouds = new THREE.Group();
    clouds.name = 'clouds';
    clouds.add(puffMesh(light, false, -1.6), puffMesh(dust, true, -1.5));
    group.add(clouds);
    // A glow that still shows edge-on, where the flat disc vanishes.
    const gc = document.createElement('canvas');
    gc.width = gc.height = 128;
    const gg = gc.getContext('2d')!;
    const gr = gg.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,226,180,.55)');
    gr.addColorStop(1, 'rgba(255,226,180,0)');
    gg.fillStyle = gr;
    gg.fillRect(0, 0, 128, 128);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, depthWrite: false, depthTest: false, opacity: 0.5 }));
    glow.scale.set(11, 7, 1);
    glow.renderOrder = -1;
    group.add(glow);
    return group;
}

// The four arms, each a log spiral r = ARM_R0 * exp(ARM_PITCH * t) at angle `off + t`. Laid out
// this way they fall where the Milky Way's do as seen from Sol (26.7 klyr out, 27 degrees off the
// bar): Norma at about 12 klyr, Scutum-Crux 17, Sagittarius 24, Sol, then Perseus 33; the
// Norma spiral's second turn is the Outer arm. Scutum-Crux and Perseus are the two major arms.
const ARM_PITCH = Math.tan((12 * Math.PI) / 180);
const ARM_R0 = 11;
const ARMS = [
    { name: 'Norma', off: Math.PI / 2, major: false },
    { name: 'Perseus', off: Math.PI, major: true },
    { name: 'Sagittarius', off: (3 * Math.PI) / 2, major: false },
    { name: 'Scutum-Crux', off: 0, major: true },
];
const armPoint = (off: number, t: number): [number, number, number] => {
    const r = ARM_R0 * Math.exp(ARM_PITCH * t);
    return [r * Math.cos(off + t), r * Math.sin(off + t), r];
};
/** Sol's own short arm, between Sagittarius and Perseus: the angle Sol sits at and how far out. */
const ORION = { angle: Math.atan2(23.79, -12.122), r: 26.7 };

/** One soft cloud: where it is (klyr), how wide, its color (0..1) and how strong. */
type Puff = [x: number, y: number, z: number, size: number, r: number, g: number, b: number, alpha: number];

/**
 * The Milky Way as a few thousand overlapping clouds, each several klyr wide so none
 * reads as a star or a place: the bulge and bar (warm, thick), four arms along the
 * painted spiral (blue-white with pink star-forming patches, thinner outward), the
 * haze between them, a faint halo, and dark dust lanes along each arm's inner edge.
 * Seeded, so the galaxy looks the same on every visit.
 */
function galaxyClouds(): { light: Puff[]; dust: Puff[] } {
    let seed = 0x5a17a;
    const rnd = () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
    const between = (lo: number, hi: number) => lo + (hi - lo) * rnd();
    const light: Puff[] = [];
    const dust: Puff[] = [];
    // Fewer clouds where the screen is small and the chip is modest
    const amount = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse), (max-width: 700px)').matches ? 0.5 : 1;
    const count = (n: number) => Math.round(n * amount);
    const strength = 1 / Math.sqrt(amount);

    // Bulge: a round, warm body, brightest and whitest at the middle
    for (let n = count(520); n > 0; n--) {
        const [x, y, z] = [gauss() * 2.9, gauss() * 2.9, gauss() * 2.0];
        const core = Math.exp(-Math.hypot(x, y, z * 1.4) / 3);
        light.push([x, y, z, between(2.4, 5), 1, 0.86 + 0.1 * core, 0.66 + 0.25 * core, strength * (0.022 + 0.045 * core)]);
    }
    // Bar along +y
    for (let n = count(320); n > 0; n--) {
        const y = between(-11.5, 11.5);
        const thin = 1 - 0.55 * (Math.abs(y) / 11.5);
        light.push([gauss() * 1.5 * thin, y, gauss() * 1.1 * thin, between(2.2, 4.2), 1, 0.8, 0.58, strength * 0.032 * thin]);
    }
    // Arms
    const tMax = Math.log((DISK_R * 0.96) / ARM_R0) / ARM_PITCH;
    ARMS.forEach(({ off, major }, arm) => {
        const at = (t: number) => {
            const [x, y, r] = armPoint(off, t);
            return { r, x, y, width: (1.5 + r / 13) * (major ? 1 : 0.72) };
        };
        for (let n = count(major ? 1500 : 950); n > 0; n--) {
            const u = rnd();
            const p = at(u * tMax);
            // Clumps: the arm is patchy, not a smooth band
            const clump = 0.45 + 0.55 * Math.pow(Math.sin(u * 37 + arm * 1.7) * 0.5 + 0.5, 1.5);
            const [dx, dy] = [gauss() * p.width * 0.62, gauss() * p.width * 0.62];
            const z = gauss() * (0.95 - 0.5 * (p.r / DISK_R));
            const fade = (major ? 1 : 0.7) * (1 - 0.45 * u) * clump;
            const kind = rnd();
            if (kind < 0.07) light.push([p.x + dx, p.y + dy, z * 0.6, between(2, 3.2), 1, 0.5, 0.68, strength * 0.085 * fade]);
            else if (kind < 0.2) light.push([p.x + dx, p.y + dy, z * 0.7, between(2, 3.4), 0.82, 0.92, 1, strength * 0.09 * fade]);
            else light.push([p.x + dx, p.y + dy, z, between(2.6, 6), 0.5 + 0.2 * rnd(), 0.66 + 0.12 * rnd(), 1, strength * 0.05 * fade]);
        }
        // Dust lane on the inner (leading) edge
        for (let n = count(major ? 600 : 340); n > 0; n--) {
            const u = 0.04 + 0.9 * rnd();
            const p = at(u * tMax);
            const inward = 1 - (0.55 * p.width + gauss() * 0.3 * p.width) / p.r;
            dust.push([p.x * inward, p.y * inward, gauss() * 0.3, between(2.6, 5.2), 0.02, 0.015, 0.03, strength * 0.085 * (1 - 0.5 * u)]);
        }
    });
    // The Orion Spur: the short, faint arm Sol sits in
    for (let n = count(150); n > 0; n--) {
        const turn = between(-0.75, 0.6);
        const r = ORION.r * Math.exp(ARM_PITCH * 1.4 * turn);
        const fade = 1 - Math.abs(turn + 0.075) / 0.72;
        light.push([r * Math.cos(ORION.angle + turn) + gauss() * 1.1, r * Math.sin(ORION.angle + turn) + gauss() * 1.1, gauss() * 0.55, between(2.4, 4.6), 0.6, 0.74, 1, strength * 0.05 * fade]);
    }
    // The thin disc between the arms
    for (let n = count(700); n > 0; n--) {
        const r = 6 + (DISK_R * 0.93 - 6) * Math.pow(rnd(), 0.8);
        const a = rnd() * Math.PI * 2;
        light.push([r * Math.cos(a), r * Math.sin(a), gauss() * 0.7, between(4.5, 9), 0.6, 0.66, 0.9, strength * 0.02 * (1 - 0.55 * (r / DISK_R))]);
    }
    // Halo
    for (let n = count(140); n > 0; n--) {
        light.push([gauss() * 13, gauss() * 13, gauss() * 8, between(10, 18), 0.75, 0.78, 1, strength * 0.007]);
    }
    return { light, dust };
}

/**
 * Draws puffs as camera-facing discs that are solid at the middle and gone at the rim, all
 * in one call. Light adds to what is behind it and dust covers it; both also keep count, in
 * the alpha channel, of how much of the background is left, so the same meshes can be drawn
 * straight onto the map or into a picture of their own that is laid over it afterwards
 * (`cloudLayer`). A puff that would fill the screen thins out and then is not drawn at all:
 * up close it would be a wash over everything, at the price of the whole screen per puff.
 */
function puffMesh(puffs: Puff[], dust: boolean, renderOrder: number): THREE.Mesh {
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    const flat = new Float32Array(puffs.length * 8);
    puffs.forEach((puff, i) => flat.set(puff, i * 8));
    const buffer = new THREE.InstancedInterleavedBuffer(flat, 8);
    geo.setAttribute('center', new THREE.InterleavedBufferAttribute(buffer, 4, 0));
    geo.setAttribute('tint', new THREE.InterleavedBufferAttribute(buffer, 4, 4));
    geo.instanceCount = puffs.length;
    const mesh = new THREE.Mesh(
        geo,
        new THREE.ShaderMaterial({
            vertexShader: `
                attribute vec4 center;
                attribute vec4 tint;
                varying vec2 vAt;
                varying vec4 vTint;
                void main() {
                    vAt = position.xy;
                    vec4 mv = modelViewMatrix * vec4(center.xyz, 1.0);
                    // The puff's width in screen heights
                    float span = center.w * projectionMatrix[1][1] / (2.0 * max(-mv.z, 0.001));
                    float keep = 1.0 - smoothstep(1.0, 2.5, span);
                    vTint = vec4(tint.rgb, tint.a * keep);
                    mv.xy += position.xy * center.w * 0.5;
                    gl_Position = keep > 0.0 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
                }`,
            fragmentShader: `
                varying vec2 vAt;
                varying vec4 vTint;
                void main() {
                    float d = dot(vAt, vAt);
                    if (d > 1.0) discard;
                    float soft = exp(-d * 4.0) - 0.0183;
                    gl_FragColor = vec4(vTint.rgb, vTint.a * soft);
                }`,
            transparent: true,
            depthWrite: false,
            depthTest: false,
            blending: THREE.CustomBlending,
            blendSrc: THREE.SrcAlphaFactor,
            blendDst: dust ? THREE.OneMinusSrcAlphaFactor : THREE.OneFactor,
            blendSrcAlpha: dust ? THREE.OneFactor : THREE.ZeroFactor,
            blendDstAlpha: dust ? THREE.OneMinusSrcAlphaFactor : THREE.OneFactor,
        }),
    );
    mesh.frustumCulled = false;
    mesh.renderOrder = renderOrder;
    return mesh;
}

/** The clouds' picture is this fraction of the map's own size each way: they are soft, so it does not show. */
const CLOUD_SCALE = 0.5;

/**
 * Where the live scene draws the clouds: a picture of their own, smaller than the screen
 * (thousands of overlapping puffs are most of the map's cost, and it goes by the pixel), and
 * the full-screen sheet that lays that picture over the painted disc.
 */
function cloudLayer(): { target: THREE.WebGLRenderTarget; sheet: THREE.Mesh } {
    const target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
    const sheet = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.ShaderMaterial({
            uniforms: { map: { value: target.texture } },
            vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
            fragmentShader: 'uniform sampler2D map; varying vec2 vUv; void main() { gl_FragColor = texture2D(map, vUv); }',
            depthTest: false,
            depthWrite: false,
            transparent: true,
            // The picture's color already has its strength in it; its alpha is how much it hides
            blending: THREE.CustomBlending,
            blendSrc: THREE.OneFactor,
            blendDst: THREE.OneMinusSrcAlphaFactor,
            blendSrcAlpha: THREE.OneFactor,
            blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
        }),
    );
    sheet.frustumCulled = false;
    sheet.renderOrder = -1.55;
    return { target, sheet };
}

type Groups = Record<'galaxy' | 'grid' | 'octants' | 'ring' | 'terr' | 'rim' | 'bearings' | 'transit', THREE.Object3D>;

/** Everything the map draws, one group per layer. `onTerritories` runs once the territory picture has loaded into its group. */
function buildWorld(fontDisplay: string, onTerritories?: () => void): Groups {
    const galaxy = buildGalaxy();
    const grid = buildGrid();
    const octants = buildOctants(fontDisplay);
    const ring = dashedRing(DISK_R, '#8792a8', 0.6);
    const rim = buildRim();
    const terr = new THREE.Group();
    terr.rotation.z = MAP_ROT;
    terr.add(
        textSprite('Galactic Union', REGIONS.gu.color, fontDisplay, [-5.5, 16, 1.2], 3),
        textSprite('ADE', REGIONS.ade.color, fontDisplay, [23.2, -6.4, 1.2], 3),
        textSprite('Llamanian Republic', REGIONS.lr.color, fontDisplay, [-0.3, -23, 1.2], 3),
    );
    const bearings = new THREE.Group();
    const and = new THREE.Vector3(ANDROMEDA_DIR[0], ANDROMEDA_DIR[1], 0);
    bearings.add(
        new THREE.ArrowHelper(and, and.clone().multiplyScalar(47), 8, 0x8792a8, 2, 1.2),
        textSprite('toward Andromeda', '#8792a8', fontDisplay, [and.x * 60, and.y * 60, 1.5], 3),
        textSprite('Galactic bar', '#8792a8', fontDisplay, [3.5, 13, 1.6], 2.6),
    );
    new THREE.TextureLoader().load('/galaxy/territories.png', (tex) => {
        const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(800 / PPK, 600 / PPK),
            new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
        );
        plane.position.set((400 - 336) / PPK, -(300 - 356) / PPK, -0.05);
        terr.add(plane);
        onTerritories?.();
    });
    // The slab's thickness, hinted by a faint outline above and below the plane.
    for (const z of [H, -H]) {
        const box = new THREE.LineLoop(
            new THREE.BufferGeometry().setFromPoints([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => new THREE.Vector3(sx * N * S, sy * N * S, z))),
            new THREE.LineBasicMaterial({ color: '#8792a8', transparent: true, opacity: 0.12 }),
        );
        grid.add(box);
    }
    return { galaxy, rim, terr, grid, octants, ring, bearings, transit: buildTransit(fontDisplay) };
}

/** A flat colored band along a path on the plane, like a line on a transit map. */
function ribbon(path: [number, number][], color: string, width = 0.55): THREE.Mesh {
    const position: number[] = [];
    const index: number[] = [];
    path.forEach(([x, y], i) => {
        const [ax, ay] = path[Math.max(0, i - 1)];
        const [bx, by] = path[Math.min(path.length - 1, i + 1)];
        const len = Math.hypot(bx - ax, by - ay) || 1;
        const [nx, ny] = [(-(by - ay) / len) * (width / 2), ((bx - ax) / len) * (width / 2)];
        position.push(x + nx, y + ny, 0.3, x - nx, y - ny, 0.3);
        if (i > 0) index.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i, 2 * i - 1, 2 * i + 1);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    geo.setIndex(index);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
    mesh.renderOrder = 2;
    return mesh;
}

// The line colors of the old "Comprehensive Map" (the subway-style one). Perseus was not on it.
const LINE_COLORS = { outer: '#ff2fd6', threeKpc: '#ffe600', scutum: '#22e02a', sagittarius: '#2f8cff', perseus: '#35d6d0', bakree: '#ff2a2a', omega: '#ff8a1f' };
/** The routes between saved places, by slug, in order. */
const ROUTES: { color: string; stops: string[] }[] = [
    { color: LINE_COLORS.bakree, stops: ['bakree_nebula', 'sol', 'ptorei_nebula'] },
    { color: LINE_COLORS.omega, stops: ['geche_customs', 'padox_district', 'bagriburg', 'vanta_outer_junction'] },
];

/**
 * The transit-map layer: each arm drawn as a colored line along its spiral, named as on
 * the old subway-style map (the Norma spiral is "3kpc" near the bar and "Outer" beyond
 * 20 klyr). The routes between places are added by the scene, which knows the places.
 */
function buildTransit(fontDisplay: string): THREE.Group {
    const group = new THREE.Group();
    const tMax = Math.log((DISK_R * 0.97) / ARM_R0) / ARM_PITCH;
    const spiral = (off: number, from: number, to: number): [number, number][] => {
        const path: [number, number][] = [];
        for (let n = 0; n <= 160; n++) {
            const [x, y] = armPoint(off, from + ((to - from) * n) / 160);
            path.push([x, y]);
        }
        return path;
    };
    const label = (text: string, color: string, off: number, t: number) => {
        const [x, y, r] = armPoint(off, t);
        group.add(textSprite(text, color, fontDisplay, [x * (1 + 2 / r), y * (1 + 2 / r), 0.6], 2.6));
    };
    const split = Math.log(20 / ARM_R0) / ARM_PITCH;
    const [norma, perseus, sagittarius, scutum] = ARMS;
    group.add(
        ribbon(spiral(norma.off, 0, split), LINE_COLORS.threeKpc),
        ribbon(spiral(norma.off, split, tMax), LINE_COLORS.outer),
        ribbon(spiral(perseus.off, 0, tMax), LINE_COLORS.perseus),
        ribbon(spiral(sagittarius.off, 0, tMax), LINE_COLORS.sagittarius),
        ribbon(spiral(scutum.off, 0, tMax), LINE_COLORS.scutum),
    );
    label('3kpc', LINE_COLORS.threeKpc, norma.off, split * 0.45);
    label('Outer', LINE_COLORS.outer, norma.off, tMax * 0.86);
    label('Perseus', LINE_COLORS.perseus, perseus.off, tMax * 0.7);
    label('Sagittarius', LINE_COLORS.sagittarius, sagittarius.off, tMax * 0.62);
    label('Scutum-Crux', LINE_COLORS.scutum, scutum.off, tMax * 0.55);
    const routes = new THREE.Group();
    routes.name = 'routes';
    group.add(routes);
    group.visible = false;
    return group;
}

// The site's starfield (public/images/starfield.svg), which tiles seamlessly at this size
const STAR_TILE = { w: 1334, h: 1000 };
const VOID = '#05080e';

/** The starfield tile painted onto the map's own black, as a texture that repeats. */
function loadStarfield(): Promise<THREE.Texture | null> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const c = document.createElement('canvas');
            c.width = STAR_TILE.w;
            c.height = STAR_TILE.h;
            const g = c.getContext('2d')!;
            g.fillStyle = VOID;
            g.fillRect(0, 0, c.width, c.height);
            g.drawImage(img, 0, 0, c.width, c.height);
            const tex = new THREE.CanvasTexture(c);
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            resolve(tex);
        };
        img.onerror = () => resolve(null);
        img.src = '/images/starfield.svg';
    });
}

/**
 * The starfield behind the map, two ways. `box` is a skybox for the rotating view: a
 * cube around the camera with the tile repeated on every face (the scene keeps it
 * centred on the camera, so the stars turn with the view and never come nearer).
 * `flat` is for top-down and the still picture: the tile laid straight onto the
 * screen at its own size, `pixelRatio` device pixels to one of its own.
 */
function buildSky(tex: THREE.Texture, pixelRatio: number, opacity: number): Sky {
    const faces = tex.clone();
    // A face spans 90 degrees; this many tiles across it keeps a star about its drawn size at the map's lens
    faces.repeat.set(1.5, 2);
    faces.needsUpdate = true;
    const box = new THREE.Mesh(new THREE.BoxGeometry(2000, 2000, 2000), new THREE.MeshBasicMaterial({ map: faces, side: THREE.BackSide, depthTest: false, depthWrite: false, transparent: true, opacity }));
    const flat = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.ShaderMaterial({
            uniforms: { map: { value: tex }, tile: { value: new THREE.Vector2(STAR_TILE.w * pixelRatio, STAR_TILE.h * pixelRatio) }, opacity: { value: opacity } },
            vertexShader: 'void main() { gl_Position = vec4(position.xy, 1.0, 1.0); }',
            fragmentShader: `
                uniform sampler2D map;
                uniform vec2 tile;
                uniform float opacity;
                void main() {
                    gl_FragColor = vec4(texture2D(map, gl_FragCoord.xy / tile).rgb, opacity);
                    #include <colorspace_fragment>
                }`,
            depthTest: false,
            depthWrite: false,
            transparent: true,
        }),
    );
    for (const mesh of [box, flat]) {
        mesh.frustumCulled = false;
        mesh.renderOrder = -100;
    }
    return { box, flat };
}

interface Sky {
    box: THREE.Mesh;
    flat: THREE.Mesh;
}

/** Fades the starfield toward the map's black: 0 is none of it, 1 all of it. */
function setSkyOpacity(sky: Sky, opacity: number) {
    (sky.box.material as THREE.MeshBasicMaterial).opacity = opacity;
    (sky.flat.material as THREE.ShaderMaterial).uniforms.opacity.value = opacity;
}

/** Half the width, in klyr, of the square the still picture covers (top-down, +y up, Sagittarius A in the middle). */
export const STILL_HALF = 52;
/** How strongly the still picture shows the starfield (the setting's default). */
const STILL_SKY = 0.25;

/**
 * The map as one top-down picture, for browsers without WebGL (which cannot run this:
 * `/galaxy/still`, a dev-only page, draws it for saving as public/galaxy/still.webp).
 * Answers a data URL once the territory picture is in.
 */
export function renderStill(size: number, fontDisplay: string): Promise<string> {
    return new Promise((resolve) => {
        const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        renderer.setSize(size, size, false);
        renderer.setClearColor(new THREE.Color(VOID));
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-STILL_HALF, STILL_HALF, STILL_HALF, -STILL_HALF, 0.1, 1000);
        camera.position.set(0, 0, 200);
        camera.up.set(0, 1, 0);
        camera.lookAt(0, 0, 0);
        const stars = loadStarfield();
        const groups = buildWorld(fontDisplay, () => {
            void stars.then((tex) => {
                if (tex) scene.add(buildSky(tex, 1, STILL_SKY).flat);
                renderer.render(scene, camera);
                resolve(renderer.domElement.toDataURL('image/webp', 0.9));
                renderer.dispose();
            });
        });
        groups.octants.visible = false;
        groups.bearings.visible = false;
        groups.transit.visible = false;
        scene.add(...Object.values(groups));
    });
}

/** A marker on screen this frame: its dot's centre and half-size. */
interface Spot {
    node: HTMLButtonElement;
    x: number;
    y: number;
    r: number;
    /** The selection's name is placed before all others. */
    first: boolean;
    system: boolean;
}

const labelWidths = new WeakMap<HTMLElement, { text: string; width: number }>();

/**
 * Keeps name labels off other places' dots and off each other, so a label never takes a
 * neighbour's clicks: each name goes right of its dot, else left, else it is hidden
 * (`data-label`; a hidden name still shows on hover). The selection is placed first,
 * then systems, then landmarks.
 */
function declutter(spots: Spot[]) {
    spots.sort((a, b) => Number(b.first) - Number(a.first) || Number(b.system) - Number(a.system));
    const taken: [number, number, number, number][] = [];
    const free = (x0: number, y0: number, x1: number, y1: number, self: Spot) =>
        spots.every((s) => s === self || x1 < s.x - s.r || x0 > s.x + s.r || y1 < s.y - s.r || y0 > s.y + s.r) && taken.every((t) => x1 < t[0] || x0 > t[2] || y1 < t[1] || y0 > t[3]);
    for (const spot of spots) {
        const span = spot.node.lastElementChild as HTMLElement | null;
        if (!span || span.tagName !== 'SPAN') continue;
        let known = labelWidths.get(span);
        if (!known || known.text !== span.textContent) {
            known = { text: span.textContent ?? '', width: span.offsetWidth };
            labelWidths.set(span, known);
        }
        const [y0, y1] = [spot.y - 8, spot.y + 8];
        const right = spot.x + 11;
        const left = spot.x - 11 - known.width;
        let side = 'hidden';
        if (spot.first || free(right, y0, right + known.width, y1, spot)) {
            side = 'right';
            taken.push([right, y0, right + known.width, y1]);
        } else if (free(left, y0, left + known.width, y1, spot)) {
            side = 'left';
            taken.push([left, y0, left + known.width, y1]);
        }
        if (spot.node.dataset.label !== side) spot.node.dataset.label = side;
    }
}

/** Text that lives in the scene (so it sits under the place markers and scales with the map). */
function textSprite(text: string, color: string, font: string, at: [number, number, number], scale: number): THREE.Sprite {
    const c = document.createElement('canvas');
    c.width = 768;
    c.height = 128;
    const g = c.getContext('2d')!;
    g.font = `600 58px ${font}`;
    g.fillStyle = color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,.95)';
    g.shadowBlur = 14;
    g.fillText(text, 384, 64);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, depthTest: false }));
    sp.scale.set(scale * 6, scale, 1);
    sp.position.set(...at);
    sp.renderOrder = 5;
    return sp;
}

const lineSegs = (arr: number[], color: string, opacity: number) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
};

/** The plain, neutral sector grid on the plane. */
function buildGrid(): THREE.Group {
    const group = new THREE.Group();
    const fine: number[] = [];
    const axes: number[] = [];
    const L = N * S;
    for (let k = -N; k <= N; k++) {
        const arr = k === 0 ? axes : fine;
        arr.push(k * S, -L, 0, k * S, L, 0, -L, k * S, 0, L, k * S, 0);
    }
    group.add(lineSegs(fine, '#8792a8', 0.13), lineSegs(axes, '#f0b44c', 0.5));
    return group;
}

/** The Sector Grid artifact's eight colored octant slabs, with their names. */
function buildOctants(font: string): THREE.Group {
    const group = new THREE.Group();
    for (const o of OCTS) {
        const fine: number[] = [];
        const edges: number[] = [];
        const X = (v: number) => o.sx * v;
        const Y = (v: number) => o.sy * v;
        for (const z of [0, o.sz * H])
            for (let k = 0; k <= N; k++) {
                const arr = k === 0 || k === N ? edges : fine;
                arr.push(X(k * S), 0, z, X(k * S), Y(N * S), z, 0, Y(k * S), z, X(N * S), Y(k * S), z);
            }
        for (let k = 0; k <= N; k++) {
            const arr = k === 0 || k === N ? edges : fine;
            arr.push(X(k * S), Y(N * S), 0, X(k * S), Y(N * S), o.sz * H, X(N * S), Y(k * S), 0, X(N * S), Y(k * S), o.sz * H);
        }
        group.add(lineSegs(fine, o.color, 0.16), lineSegs(edges, o.color, 0.75));
        group.add(textSprite(o.key, o.color, font, [o.sx * 31, o.sy * (o.sz > 0 ? 27 : 36), o.sz * (H + 2.2)], 4.5));
    }
    return group;
}

/** Dim boxes over every Outer Rim sector, above and below the plane. */
function buildRim(): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: REGIONS.rim.color, transparent: true, opacity: 0.04, depthWrite: false });
    const geo = new THREE.BoxGeometry(S * 0.96, S * 0.96, H * 0.96);
    const mesh = new THREE.InstancedMesh(geo, mat, RIM_CELLS.length * OCTS.length);
    const m = new THREE.Matrix4();
    let n = 0;
    for (const o of OCTS) for (const [i, j] of RIM_CELLS) mesh.setMatrixAt(n++, m.makeTranslation(o.sx * (i * S + S / 2), o.sy * (j * S + S / 2), (o.sz * H) / 2));
    mesh.renderOrder = -1;
    group.add(mesh);
    return group;
}

function dashedRing(r: number, color: string, opacity: number): THREE.Line {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 180; k++) pts.push(new THREE.Vector3(r * Math.cos((k / 90) * Math.PI), r * Math.sin((k / 90) * Math.PI), 0));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color, dashSize: 1.2, gapSize: 1, transparent: true, opacity }));
    line.computeLineDistances();
    return line;
}

// The camera may not leave the galaxy: its focus stays inside the disk and it can only back off this far.
const FOCUS_R = 38;
const HOME: Vec3 = [44, -66, 44];
const FLAT_FOV = 4;
/** How much farther the long top-down lens stands to frame the same area. */
const FLAT = Math.tan((24 * Math.PI) / 180) / Math.tan(((FLAT_FOV / 2) * Math.PI) / 180);
/**
 * Where the top-down camera sits from its focus: straight above, a hair toward -y so
 * that +y (the line between the N and E octants) is always up on screen. The frame
 * loop puts the camera back on this line every frame, so top-down cannot turn or tilt.
 */
const TOP_DIR = new THREE.Vector3(0, -0.0005, 1).normalize();

export default function GalaxyScene({ places, selectedId, onSelect, view, layers, placing, onPlace, flyToken, resetToken = 0, onOpen, onStill, onAddAt, sky = STILL_SKY, paused = false }: Props) {
    const hostRef = useRef<HTMLDivElement>(null);
    const markerRefs = useRef(new Map<number, HTMLButtonElement>());
    const three = useRef<{ camera: THREE.PerspectiveCamera; controls: OrbitControls; groups: Groups; sky: Sky | null; goal: THREE.Vector3 | null; camGoal: THREE.Vector3 | null; distGoal: number | null; top: boolean; maxBase: number; /** Something changed that the camera does not show: draw the next frame. */ dirty: boolean } | null>(null);
    // The empty spot last clicked, which the "+ Add here" button hangs over
    const [spot, setSpot] = useState<Vec3 | null>(null);
    const spotRef = useRef<HTMLButtonElement>(null);
    const live = useRef({ places, placing, onPlace, onSelect, selectedId, sky, spot, canAdd: !!onAddAt, paused });
    // Written straight to the page: the pointer moves far too often to draw the whole map's markers again each time
    const readoutRef = useRef<HTMLSpanElement>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        live.current = { places, placing, onPlace, onSelect, selectedId, sky, spot, canAdd: !!onAddAt, paused };
        if (three.current?.sky) setSkyOpacity(three.current.sky, sky);
        // Whatever this render changed (places, layers, the view, the stars), the next frame draws it
        if (three.current) three.current.dirty = true;
    });

    useEffect(() => {
        const host = hostRef.current!;
        let renderer: THREE.WebGLRenderer;
        // A phone or tablet: no edge smoothing and fewer pixels, which its screen is too dense to miss
        const coarse = window.matchMedia('(pointer: coarse)').matches;
        try {
            renderer = new THREE.WebGLRenderer({ antialias: !coarse });
        } catch {
            queueMicrotask(() => setFailed(true));
            return;
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
        const voidColor = new THREE.Color(VOID);
        renderer.setClearColor(voidColor);
        host.prepend(renderer.domElement);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 6000);
        camera.up.set(0, 0, 1);
        camera.position.set(...HOME);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.minDistance = 6;
        controls.maxDistance = 150;
        // The wheel (or a pinch) zooms in on what is under it, not on the middle of the view
        controls.zoomToCursor = true;
        // The focus stays on the galactic plane (a right-drag slides along it), so zooming to a place keeps that place under the pointer
        controls.screenSpacePanning = false;

        const groups = buildWorld(getComputedStyle(host).getPropertyValue('--font-display').trim() || 'sans-serif', () => {
            if (three.current) three.current.dirty = true;
        });
        scene.add(...Object.values(groups));
        // The clouds leave the map's scene for one of their own, drawn small and laid back over the disc
        const cloudScene = new THREE.Scene();
        cloudScene.add(groups.galaxy.getObjectByName('clouds')!);
        const clouds = cloudLayer();
        groups.galaxy.add(clouds.sheet);

        three.current = { camera, controls, groups, sky: null, goal: null, camGoal: null, distGoal: null, top: false, maxBase: 150, dirty: true };
        void loadStarfield().then((tex) => {
            const t = three.current;
            if (!tex || !t || t.camera !== camera) return tex?.dispose();
            t.sky = buildSky(tex, renderer.getPixelRatio(), live.current.sky);
            scene.add(t.sky.box, t.sky.flat);
            t.dirty = true;
        });
        // A drag or a scroll takes over from any camera move in progress
        controls.addEventListener('start', () => {
            const t = three.current;
            if (t) t.goal = t.camGoal = t.distGoal = null;
        });

        const resize = () => {
            const w = host.clientWidth;
            const h = host.clientHeight;
            renderer.setSize(w, h);
            const px = renderer.getDrawingBufferSize(new THREE.Vector2());
            clouds.target.setSize(Math.max(1, Math.round(px.x * CLOUD_SCALE)), Math.max(1, Math.round(px.y * CLOUD_SCALE)));
            camera.aspect = w / Math.max(h, 1);
            camera.updateProjectionMatrix();
            // Far enough to see the whole disk (more on a tall phone screen), and no farther.
            const t = three.current!;
            t.maxBase = Math.max(150, 105 / camera.aspect);
            controls.maxDistance = t.maxBase * (t.top ? FLAT : 1);
            t.dirty = true;
        };
        const ro = new ResizeObserver(resize);
        ro.observe(host);
        resize();

        const ray = new THREE.Raycaster();
        const ndc = new THREE.Vector2();
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const hitPlane = (ev: PointerEvent): Vec3 | null => {
            const r = renderer.domElement.getBoundingClientRect();
            ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
            ray.setFromCamera(ndc, camera);
            const out = new THREE.Vector3();
            return ray.ray.intersectPlane(plane, out) ? [out.x, out.y, 0] : null;
        };
        let down: { x: number; y: number } | null = null;
        const onDown = (e: PointerEvent) => {
            down = { x: e.clientX, y: e.clientY };
        };
        const onUp = (e: PointerEvent) => {
            if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) {
                const p = hitPlane(e);
                if (live.current.placing && p && Math.hypot(p[0], p[1]) <= N * S) live.current.onPlace(p);
                else if (!live.current.placing) {
                    live.current.onSelect(null);
                    setSpot(live.current.canAdd && p && Math.hypot(p[0], p[1]) <= N * S ? p : null);
                }
            }
            down = null;
        };
        const onMove = (e: PointerEvent) => {
            const p = hitPlane(e);
            const node = readoutRef.current;
            if (!node) return;
            const region = p && Math.hypot(p[0], p[1]) <= DISK_R + 6 ? regionAt(p) : undefined;
            const text = !p || region === undefined ? '' : `${sectorOf(p)}, ${region ? REGIONS[region].short : 'unclaimed space'}`;
            if (node.textContent !== text) node.textContent = text;
        };
        const el = renderer.domElement;
        el.addEventListener('pointerdown', onDown);
        el.addEventListener('pointerup', onUp);
        el.addEventListener('pointermove', onMove);
        // A place's marker sits over the canvas: the wheel on one zooms the map there all the same
        const onMarkerWheel = (e: WheelEvent) => {
            if (e.target === el) return;
            e.preventDefault();
            el.dispatchEvent(new WheelEvent('wheel', { deltaX: e.deltaX, deltaY: e.deltaY, deltaMode: e.deltaMode, clientX: e.clientX, clientY: e.clientY, ctrlKey: e.ctrlKey, cancelable: true }));
        };
        host.addEventListener('wheel', onMarkerWheel, { passive: false });

        const v = new THREE.Vector3();
        let raf = 0;
        const shown: Spot[] = [];
        // The camera as the picture on screen was drawn from
        const drawn = { position: new THREE.Vector3(Infinity, 0, 0), turn: new THREE.Quaternion() };
        const frame = () => {
            raf = requestAnimationFrame(frame);
            const t = three.current!;
            if (live.current.paused) return;
            let dist = camera.position.distanceTo(controls.target);
            if (t.camGoal && !t.top) {
                camera.position.lerp(t.camGoal, 0.12);
                if (camera.position.distanceTo(t.camGoal) < 0.1) t.camGoal = null;
            }
            if (t.goal) {
                // The camera travels with its focus, so flying to a place slides the map and never turns it
                v.copy(controls.target);
                controls.target.lerp(t.goal, 0.12);
                if (!t.camGoal || t.top) camera.position.add(v.subVectors(controls.target, v));
                if (controls.target.distanceTo(t.goal) < 0.05) t.goal = null;
            }
            if (t.top) {
                if (t.distGoal !== null) {
                    dist += (t.distGoal - dist) * 0.12;
                    if (Math.abs(t.distGoal - dist) < 0.5) t.distGoal = null;
                }
                camera.position.copy(controls.target).addScaledVector(TOP_DIR, dist);
            }
            controls.update();
            // Keep the focus inside the disk, moving the camera with it, so panning stops at the edge.
            const tg = controls.target;
            const r = Math.hypot(tg.x, tg.y);
            const cl = r > FOCUS_R ? FOCUS_R / r : 1;
            const nx = tg.x * cl;
            const ny = tg.y * cl;
            const nz = Math.max(-H, Math.min(H, tg.z));
            if (nx !== tg.x || ny !== tg.y || nz !== tg.z) {
                camera.position.x += nx - tg.x;
                camera.position.y += ny - tg.y;
                camera.position.z += nz - tg.z;
                tg.set(nx, ny, nz);
                controls.update();
            }
            if (t.sky) {
                // A skybox while the view can turn; the same stars laid flat when it cannot
                t.sky.box.visible = !t.top;
                t.sky.flat.visible = t.top;
                t.sky.box.position.copy(camera.position);
            }
            // The camera has not moved (by a tenth of a pixel on a large screen, measured from the last
            // picture drawn, so slow drift still adds up) and nothing else changed: that picture and the markers over it still stand
            if (!t.dirty && camera.position.distanceToSquared(drawn.position) < 2.5e-8 && Math.abs(camera.quaternion.dot(drawn.turn)) > 1 - 2e-10) return;
            t.dirty = false;
            drawn.position.copy(camera.position);
            drawn.turn.copy(camera.quaternion);
            if (groups.galaxy.visible) {
                renderer.setRenderTarget(clouds.target);
                renderer.setClearColor(0x000000, 0);
                renderer.render(cloudScene, camera);
                renderer.setRenderTarget(null);
                renderer.setClearColor(voidColor, 1);
            }
            renderer.render(scene, camera);
            const w = host.clientWidth;
            const h = host.clientHeight;
            for (const place of live.current.places) {
                const node = markerRefs.current.get(place.id);
                if (!node) continue;
                v.set(place.pos[0], place.pos[1], place.pos[2]).project(camera);
                const hidden = v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1;
                node.style.display = hidden ? 'none' : '';
                const x = ((v.x + 1) / 2) * w;
                const y = ((1 - v.y) / 2) * h;
                node.style.transform = `translate(${x}px, ${y}px)`;
                if (!hidden) shown.push({ node, x, y, r: place.precision === 'region' ? 14 : 8, first: place.id === live.current.selectedId, system: place.kind === 'system' });
            }
            declutter(shown);
            shown.length = 0;
            const at = live.current.spot;
            if (at && spotRef.current) {
                v.set(at[0], at[1], at[2]).project(camera);
                spotRef.current.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
            }
        };
        frame();

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            host.removeEventListener('wheel', onMarkerWheel);
            controls.dispose();
            clouds.target.dispose();
            renderer.dispose();
            renderer.domElement.remove();
            three.current = null;
        };
    }, []);

    // View lock: top-down is a straight-down camera that a drag cannot move. Zooming goes
    // to the pointer, and it still slides to a place that is picked and back on Recenter.
    useEffect(() => {
        const t = three.current;
        if (!t) return;
        const { camera, controls } = t;
        const top = view === 'top' || placing;
        const wasTop = t.top;
        t.top = top;
        const dist = camera.position.distanceTo(controls.target) / (wasTop ? FLAT : 1);
        const f = top ? FLAT : 1;
        controls.enableRotate = !top;
        controls.enablePan = !top;
        controls.mouseButtons.LEFT = top ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
        controls.touches.ONE = top ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
        controls.touches.TWO = top ? THREE.TOUCH.DOLLY_PAN : THREE.TOUCH.DOLLY_ROTATE;
        // Top-down is drawn flat (no perspective): a very long lens from very far away.
        camera.fov = top ? FLAT_FOV : 48;
        camera.updateProjectionMatrix();
        controls.minDistance = 6 * f;
        controls.maxDistance = t.maxBase * f;
        t.camGoal = null;
        t.distGoal = null;
        if (top) {
            // Far enough back that the whole disk fits a narrow (phone) viewport.
            const z = Math.min(t.maxBase, Math.max(dist, 30, camera.aspect < 1 ? 105 / camera.aspect : 0)) * f;
            camera.position.copy(controls.target).addScaledVector(TOP_DIR, z);
        } else if (wasTop || camera.position.z > dist * 0.95) camera.position.set(controls.target.x + dist * 0.5, controls.target.y - dist * 0.7, dist * 0.5);
        controls.update();
    }, [view, placing]);

    useEffect(() => {
        const t = three.current;
        if (!t) return;
        const g = t.groups;
        g.galaxy.visible = layers.galaxy;
        g.terr.visible = layers.territories;
        g.rim.visible = layers.rim;
        // The octant slabs draw their own plane grid, so the plain one steps aside.
        g.grid.visible = layers.grid && !layers.octants;
        g.octants.visible = layers.octants;
        g.ring.visible = layers.grid || layers.octants || layers.galaxy;
        g.bearings.visible = layers.bearings;
        g.transit.visible = layers.transit;
    }, [layers]);

    // The transit layer's routes run between saved places, so they follow the places
    const stops = ROUTES.map((route) => route.stops.map((slug) => places.find((p) => p.slug === slug)?.pos.slice(0, 2).join(',') ?? '').join(';')).join('|');
    useEffect(() => {
        const routes = three.current?.groups.transit.getObjectByName('routes');
        if (!routes) return;
        for (const old of [...routes.children]) {
            routes.remove(old);
            (old as THREE.Mesh).geometry.dispose();
        }
        stops.split('|').forEach((route, i) => {
            const path = route.split(';').filter(Boolean).map((xy) => xy.split(',').map(Number) as [number, number]);
            if (path.length > 1) routes.add(ribbon(path, ROUTES[i].color));
        });
    }, [stops]);

    useEffect(() => {
        const t = three.current;
        if (!t || !resetToken) return;
        t.goal = new THREE.Vector3(0, 0, 0);
        t.camGoal = t.top ? null : new THREE.Vector3(...HOME);
        t.distGoal = t.top ? Math.min(t.maxBase, Math.max(110, 105 / t.camera.aspect)) * FLAT : null;
    }, [resetToken]);

    useEffect(() => {
        const t = three.current;
        const place = places.find((p) => p.id === selectedId);
        if (!t || !place) return;
        // Wait out the double-click interval, so the marker holds still for a second click.
        const timer = setTimeout(() => {
            const now = three.current;
            if (!now) return;
            // Top-down with the whole galaxy in view: the place is already on screen, so the map holds still
            if (now.top) {
                const half = (now.camera.position.distanceTo(now.controls.target) / FLAT) * Math.tan((24 * Math.PI) / 180);
                if (Math.min(half, half * now.camera.aspect) >= DISK_R * 0.9) return;
            }
            now.goal = new THREE.Vector3(place.pos[0], place.pos[1], 0);
        }, 420);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [flyToken]);

    // Without WebGL: the map as one top-down picture (public/galaxy/still.webp), with the places laid over it. No camera.
    const [box, setBox] = useState<{ w: number; h: number } | null>(null);
    useEffect(() => {
        if (!failed) return;
        onStill?.();
        const host = hostRef.current!;
        const measure = () => setBox({ w: host.clientWidth, h: host.clientHeight });
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(host);
        return () => ro.disconnect();
    }, [failed, onStill]);
    const side = box ? Math.min(box.w, box.h) : 0;
    useEffect(() => {
        if (!failed || !box) return;
        const spots: Spot[] = [];
        for (const place of places) {
            const node = markerRefs.current.get(place.id);
            if (!node) continue;
            const x = box.w / 2 + (place.pos[0] / STILL_HALF) * (side / 2);
            const y = box.h / 2 - (place.pos[1] / STILL_HALF) * (side / 2);
            node.style.transform = `translate(${x}px, ${y}px)`;
            spots.push({ node, x, y, r: place.precision === 'region' ? 14 : 8, first: place.id === selectedId, system: place.kind === 'system' });
        }
        declutter(spots);
    }, [failed, box, side, places, selectedId, layers.labels]);
    const clickStill = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!failed || !box) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left - box.w / 2) / (side / 2)) * STILL_HALF;
        const y = (-(e.clientY - rect.top - box.h / 2) / (side / 2)) * STILL_HALF;
        if (placing && Math.hypot(x, y) <= N * S) onPlace([x, y, 0]);
        else if (!placing) {
            onSelect(null);
            setSpot(onAddAt && Math.hypot(x, y) <= N * S ? [x, y, 0] : null);
        }
    };
    // Gone once something is picked or a spot is being placed; Escape puts it away
    const showSpot = spot && onAddAt && !placing && selectedId === null;
    useEffect(() => {
        if (!showSpot) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSpot(null);
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [showSpot]);

    return (
        <div ref={hostRef} className={`${styles.scene} ${placing ? styles.scenePlacing : ''} ${failed ? styles.sceneStill : ''}`} onClick={failed ? clickStill : undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {failed && <img className={styles.still} src='/galaxy/still.webp' alt='The galaxy from above, with its territories' style={{ width: side, height: side }} />}
            {places.map((place) => {
                const star = starOf(place);
                const color = place.kind === 'system' ? (STAR_TYPES[star?.type ?? '']?.color ?? '#ffe9a8') : '#7fd3e8';
                return (
                    <button
                        key={place.id}
                        type='button'
                        ref={(node) => {
                            if (node) markerRefs.current.set(place.id, node);
                            else markerRefs.current.delete(place.id);
                        }}
                        className={[styles.marker, place.kind === 'landmark' && styles.markerLandmark, place.precision === 'region' && styles.markerFuzzy, place.id === selectedId && styles.markerSelected]
                            .filter(Boolean)
                            .join(' ')}
                        style={{ '--marker': color } as React.CSSProperties}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (!placing) {
                                setSpot(null);
                                onSelect(place.id);
                            }
                        }}
                        onDoubleClick={() => !placing && onOpen?.(place.id)}
                        title={place.precision === 'region' ? `${place.name} (rough position)` : place.name}
                    >
                        <i />
                        {layers.labels && <span>{place.placeholder ? (place.bodies.find((b) => b.kind === 'planet')?.name ?? place.name) : place.name}</span>}
                    </button>
                );
            })}
            {showSpot && (
                <button
                    ref={spotRef}
                    type='button'
                    className={styles.addHere}
                    style={failed && box ? { transform: `translate(${box.w / 2 + (spot[0] / STILL_HALF) * (side / 2)}px, ${box.h / 2 - (spot[1] / STILL_HALF) * (side / 2)}px)` } : undefined}
                    onClick={(e) => {
                        e.stopPropagation();
                        setSpot(null);
                        onAddAt(spot);
                    }}
                    title={sectorOf(spot)}
                >
                    <span>+ Add here</span>
                </button>
            )}
            <div className={styles.readout}>{placing && 'Click to place. '}<span ref={readoutRef} /></div>
        </div>
    );
}
