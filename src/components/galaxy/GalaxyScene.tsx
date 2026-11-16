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
    const b = Math.tan((12 * Math.PI) / 180);
    const R0 = 11;
    const tMax = Math.log(DISK_R / R0) / b;
    for (let arm = 0; arm < 4; arm++) {
        const major = arm % 2 === 0;
        const off = Math.PI / 2 + (arm * Math.PI) / 2;
        for (let n = 0; n <= 260; n++) {
            const t = (n / 260) * tMax;
            const r = R0 * Math.exp(b * t);
            const w = (2.2 + r / 12) * (major ? 1 : 0.75);
            blob(r * Math.cos(off + t), r * Math.sin(off + t), w, '150,185,255', (major ? 0.05 : 0.032) * (1 - (0.6 * n) / 260));
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

export default function GalaxyScene({ places, selectedId, onSelect, view, layers, placing, onPlace, flyToken, resetToken = 0, onOpen }: Props) {
    const hostRef = useRef<HTMLDivElement>(null);
    const markerRefs = useRef(new Map<number, HTMLButtonElement>());
    const three = useRef<{ camera: THREE.PerspectiveCamera; controls: OrbitControls; groups: Record<'galaxy' | 'grid' | 'octants' | 'ring' | 'terr' | 'rim' | 'bearings', THREE.Object3D>; goal: THREE.Vector3 | null; camGoal: THREE.Vector3 | null; distGoal: number | null; top: boolean; maxBase: number } | null>(null);
    const live = useRef({ places, placing, onPlace, onSelect, selectedId });
    const [readout, setReadout] = useState('');
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        live.current = { places, placing, onPlace, onSelect, selectedId };
    });

    useEffect(() => {
        const host = hostRef.current!;
        let renderer: THREE.WebGLRenderer;
        try {
            renderer = new THREE.WebGLRenderer({ antialias: true });
        } catch {
            queueMicrotask(() => setFailed(true));
            return;
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearColor(new THREE.Color('#05080e'));
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

        const fontDisplay = getComputedStyle(host).getPropertyValue('--font-display').trim() || 'sans-serif';
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
        scene.add(galaxy, rim, terr, grid, octants, ring, bearings);
        new THREE.TextureLoader().load('/galaxy/territories.png', (tex) => {
            const plane = new THREE.Mesh(
                new THREE.PlaneGeometry(800 / PPK, 600 / PPK),
                new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
            );
            plane.position.set((400 - 336) / PPK, -(300 - 356) / PPK, -0.05);
            terr.add(plane);
        });
        // The slab's thickness, hinted by a faint outline above and below the plane.
        for (const z of [H, -H]) {
            const box = new THREE.LineLoop(
                new THREE.BufferGeometry().setFromPoints([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => new THREE.Vector3(sx * N * S, sy * N * S, z))),
                new THREE.LineBasicMaterial({ color: '#8792a8', transparent: true, opacity: 0.12 }),
            );
            grid.add(box);
        }

        three.current = { camera, controls, groups: { galaxy, grid, octants, ring, terr, rim, bearings }, goal: null, camGoal: null, distGoal: null, top: false, maxBase: 150 };
        // A drag or a scroll takes over from any camera move in progress
        controls.addEventListener('start', () => {
            const t = three.current;
            if (t) t.goal = t.camGoal = t.distGoal = null;
        });

        const resize = () => {
            const w = host.clientWidth;
            const h = host.clientHeight;
            renderer.setSize(w, h);
            camera.aspect = w / Math.max(h, 1);
            camera.updateProjectionMatrix();
            // Far enough to see the whole disk (more on a tall phone screen), and no farther.
            const t = three.current!;
            t.maxBase = Math.max(150, 105 / camera.aspect);
            controls.maxDistance = t.maxBase * (t.top ? FLAT : 1);
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
                else if (!live.current.placing) live.current.onSelect(null);
            }
            down = null;
        };
        const onMove = (e: PointerEvent) => {
            const p = hitPlane(e);
            if (!p || Math.hypot(p[0], p[1]) > DISK_R + 6) return setReadout('');
            const region = regionAt(p);
            setReadout(`${sectorOf(p)}, ${region ? REGIONS[region].short : 'unclaimed space'}`);
        };
        const el = renderer.domElement;
        el.addEventListener('pointerdown', onDown);
        el.addEventListener('pointerup', onUp);
        el.addEventListener('pointermove', onMove);

        const v = new THREE.Vector3();
        let raf = 0;
        const shown: Spot[] = [];
        const frame = () => {
            raf = requestAnimationFrame(frame);
            const t = three.current!;
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
        };
        frame();

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            controls.dispose();
            renderer.dispose();
            renderer.domElement.remove();
            three.current = null;
        };
    }, []);

    // View lock: top-down is a straight-down camera with rotation off (drag pans).
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
    }, [layers]);

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
            if (three.current) three.current.goal = new THREE.Vector3(place.pos[0], place.pos[1], 0);
        }, 420);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [flyToken]);

    return (
        <div ref={hostRef} className={`${styles.scene} ${placing ? styles.scenePlacing : ''}`}>
            {failed && <p className={styles.sceneFail}>This browser cannot draw the 3D map (WebGL is unavailable).</p>}
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
                            if (!placing) onSelect(place.id);
                        }}
                        onDoubleClick={() => !placing && onOpen?.(place.id)}
                        title={place.precision === 'region' ? `${place.name} (rough position)` : place.name}
                    >
                        <i />
                        {layers.labels && <span>{place.placeholder ? (place.bodies.find((b) => b.kind === 'planet')?.name ?? place.name) : place.name}</span>}
                    </button>
                );
            })}
            <div className={styles.readout}>{placing ? `Click to place. ${readout}` : readout}</div>
        </div>
    );
}
