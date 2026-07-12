'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '@/components/theme/ThemeProvider';
import { starColor } from '@/lib/space';
import type { GalaxyLandmarkSummary, GalaxySelection, GalaxySystemSummary } from './types';
import styles from './space.module.scss';

// The galaxy map as a plotting chart, not a picture: the map image, a faint
// graticule, system/landmark markers, and a pointer-tracking crosshair whose
// position updates via direct DOM refs (not React state) so it never forces
// a re-render. Canvas hit-testing selects a marker; selection also drives
// (and is driven by) the rail list in the parent.
//
// Authoring (3.3): GalaxyMap is purely an interaction surface — it reports
// clicks/drags via callbacks and never persists anything itself. The parent
// (GalaxyConsole) owns `systems`/`landmarks` as local optimistic state, does
// the PUT, and reverts on failure; this component just redraws whatever it's
// handed. Two modes layer on top of plain select:
//  - "armed" (parent-driven): every click anywhere on the map places the
//    armed marker at that point. Drag-start is suppressed while armed so a
//    stray drag on a *different* marker can't hijack the placement.
//  - drag-to-move: pointerdown on an editable, already-placed marker (only
//    when nothing is armed) starts a drag; a small movement threshold tells
//    it apart from a plain click-to-select. The live drag position is kept
//    in a ref and pushed straight into a manual draw() call — no re-render
//    per pixel, same trick as the crosshair.
//
// Coordinate spaces (the map-projection fix): `xPos`/`yPos` on systems and
// landmarks are normalized **image** coordinates — (0,0) is the top-left of
// /space/galaxy.png, (1,1) its bottom-right — independent of the viewport's
// aspect ratio. The image itself is drawn **contain-fit** (aspect-preserved,
// centered, fully visible, letterboxed as needed) rather than cover-fit,
// since cover-fit would crop parts of the map offscreen and make some
// positions unreachable. `imageRect()` computes the drawn image's rect in
// canvas CSS-pixel space; `imageToCanvas()`/`canvasToImage()` are the only
// conversions between image-fraction space and canvas-pixel space, and
// every consumer below (draw, hit-test, hover, crosshair, click-to-place,
// drag) goes through them. The `.imageBox` DOM node mirrors the same rect
// for the crosshair/flash DOM overlays, so they need no separate math: a
// child positioned at `{x*100}%` of `.imageBox` lands on the same image
// pixel as a canvas marker plotted via `imageToCanvas`.

interface Props {
    mapImage: string | null;
    systems: GalaxySystemSummary[];
    landmarks: GalaxyLandmarkSummary[];
    selected: GalaxySelection | null;
    onSelect: (sel: GalaxySelection | null) => void;
    /** Live pointer coordinates (normalized 0..1 **image** space), or null on
     *  pointer-leave *or* whenever the pointer is over the letterbox (outside
     *  the drawn image rect) — treated the same as leaving the canvas. The
     *  parent owns the toolbar's grid-ref DOM node and mutates it itself — a
     *  callback (not a ref prop) keeps that mutation local to its owner, which
     *  the React Compiler's immutability check requires. */
    onCoordsChange: (coords: { x: number; y: number } | null) => void;
    /** Session identity, used only to decide drag/arm eligibility — the
     *  server re-checks ownership regardless. */
    currentUserId: number | null;
    isAdmin: boolean;
    /** The marker armed for click-to-place, or null. While armed, any click
     *  on the map (regardless of what's under the cursor) stamps the armed
     *  marker there via onPlace — unless the click lands in the letterbox,
     *  which is ignored entirely (no placement outside the image). */
    armed: GalaxySelection | null;
    /** Fired at the end of a click-to-place or a completed drag, with
     *  normalized 0..1 **image** coordinates. The parent does the optimistic
     *  update + PUT. */
    onPlace: (sel: GalaxySelection, coords: { x: number; y: number }) => void;
    /** Bumped (new token) by the parent after a successful place/move to
     *  trigger the two-blink confirm at the marker's new position. */
    flashSignal: { sel: GalaxySelection; token: number } | null;
}

const HIT_RADIUS_PX = 14;
const DRAG_THRESHOLD_PX = 5;

function clamp01(n: number): number {
    return Math.min(1, Math.max(0, n));
}

/** The drawn map image's rect, in canvas CSS-pixel space (contain-fit:
 *  aspect-preserved, centered, letterboxed). Falls back to the full canvas
 *  when there's no loaded image, so an imageless galaxy behaves like a
 *  borderless plot (no letterbox to speak of). */
interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** image-fraction (0..1, may be temporarily out of range mid-drag/hover) → canvas CSS pixels */
function imageToCanvas(pos: { x: number; y: number }, rect: Rect): { x: number; y: number } {
    return { x: rect.x + pos.x * rect.width, y: rect.y + pos.y * rect.height };
}

/** canvas CSS pixels → image-fraction (unclamped — caller decides whether
 *  out-of-[0,1] means "in the letterbox, ignore" or "clamp to the edge"). */
function canvasToImage(px: number, py: number, rect: Rect): { x: number; y: number } | null {
    if (rect.width <= 0 || rect.height <= 0) return null;
    return { x: (px - rect.x) / rect.width, y: (py - rect.y) / rect.height };
}

export default function GalaxyMap({
    mapImage,
    systems,
    landmarks,
    selected,
    onSelect,
    onCoordsChange,
    currentUserId,
    isAdmin,
    armed,
    onPlace,
    flashSignal,
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageBoxRef = useRef<HTMLDivElement>(null);
    const xhVRef = useRef<HTMLDivElement>(null);
    const xhHRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const { colorMode } = useTheme();

    const [cursor, setCursor] = useState<'default' | 'crosshair' | 'grab' | 'grabbing'>('default');
    const [flash, setFlash] = useState<{ x: number; y: number; key: number } | null>(null);
    const [seenFlashToken, setSeenFlashToken] = useState<number | null>(null);

    const placed = systems.filter((s): s is GalaxySystemSummary & { xPos: number; yPos: number } => s.xPos !== null && s.yPos !== null);

    // The single source of truth for where the image is drawn, given the
    // *current* imgRef (natural size) and a requested viewport size. Not a
    // useCallback: it's a cheap closure over a ref, recreated each render
    // like any other plain function, and called fresh inside draw()/pointer
    // handlers rather than memoized.
    const imageRect = (w: number, h: number): Rect => {
        const img = imgRef.current;
        if (!img || !img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) {
            return { x: 0, y: 0, width: w, height: h };
        }
        const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
        const width = img.naturalWidth * scale;
        const height = img.naturalHeight * scale;
        return { x: (w - width) / 2, y: (h - height) / 2, width, height };
    };

    // Two-blink placement confirm: when the parent bumps flashSignal's token
    // after a successful place/move, render a short-lived DOM overlay at the
    // marker's (now updated) position. This adjusts state during render
    // (React's documented escape hatch for "derive state from a change")
    // rather than an effect, since a plain effect here would set state
    // synchronously on mount/update. Position is a plain image-fraction —
    // the overlay lives inside `.imageBox` (sized/positioned in draw()) and
    // is placed via percentage, same as a marker's image-space coords.
    if (flashSignal && flashSignal.token !== seenFlashToken) {
        setSeenFlashToken(flashSignal.token);
        const { sel } = flashSignal;
        let pos: { x: number; y: number } | null = null;
        if (sel.kind === 'system') {
            const sys = systems.find((s) => s.id === sel.id);
            if (sys && sys.xPos !== null && sys.yPos !== null) pos = { x: sys.xPos, y: sys.yPos };
        } else {
            const lm = landmarks.find((l) => l.id === sel.id);
            if (lm) pos = { x: lm.xPos, y: lm.yPos };
        }
        if (pos) setFlash({ x: pos.x, y: pos.y, key: flashSignal.token });
    }

    const canEditSelection = useCallback(
        (sel: GalaxySelection): boolean => {
            if (currentUserId == null) return false;
            if (isAdmin) return true;
            if (sel.kind === 'system') return systems.find((s) => s.id === sel.id)?.creatorId === currentUserId;
            return landmarks.find((l) => l.id === sel.id)?.creatorId === currentUserId;
        },
        [currentUserId, isAdmin, systems, landmarks]
    );

    // Defense in depth: only trust `armed` if it's still actually editable
    // (parent should never arm something the user can't touch, but the
    // server is the real gate either way).
    const armedEditable = armed && canEditSelection(armed) ? armed : null;

    // Live drag position, read directly inside draw() (refs don't need to be
    // in the useCallback dep list — draw() is invoked manually on every
    // pointermove tick while dragging, and each call reads .current fresh).
    // Coordinates here are image-fraction, clamped to [0,1] (dragging past
    // the image edge pins to the border).
    const dragPreviewRef = useRef<{ sel: GalaxySelection; x: number; y: number } | null>(null);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = container.getBoundingClientRect();
        const w = Math.max(1, rect.width);
        const h = Math.max(1, rect.height);
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        const cs = getComputedStyle(container);
        const gridColor = cs.getPropertyValue('--space-grid').trim() || 'rgba(149,130,238,0.14)';
        const landmarkColor = cs.getPropertyValue('--space-landmark').trim() || '#6fb7ff';
        const starFallback = cs.getPropertyValue('--space-star').trim() || '#ffcc73';
        const selectColor = cs.getPropertyValue('--accent-2').trim() || '#f39e3b';
        const monoFont = cs.getPropertyValue('--font-mono').trim() || 'monospace';

        const imgR = imageRect(w, h);

        // Report the image rect to the DOM overlay layer (crosshair, flash)
        // so they can position themselves by simple percentage of a box that
        // already matches the drawn image exactly.
        const box = imageBoxRef.current;
        if (box) {
            box.style.left = `${imgR.x}px`;
            box.style.top = `${imgR.y}px`;
            box.style.width = `${imgR.width}px`;
            box.style.height = `${imgR.height}px`;
        }

        // Background map image (contain-fit: aspect-preserved, centered,
        // letterboxed — never crops the art, so every normalized position
        // stays reachable regardless of viewport aspect ratio).
        const img = imgRef.current;
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, imgR.x, imgR.y, imgR.width, imgR.height);
        }

        // Graticule — confined to the image rect (a plotting chart's grid
        // covers its plot area, not the letterbox margins around it).
        ctx.save();
        ctx.beginPath();
        ctx.rect(imgR.x, imgR.y, imgR.width, imgR.height);
        ctx.clip();
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        const step = 60;
        ctx.beginPath();
        for (let x = imgR.x; x <= imgR.x + imgR.width; x += step) {
            ctx.moveTo(x + 0.5, imgR.y);
            ctx.lineTo(x + 0.5, imgR.y + imgR.height);
        }
        for (let y = imgR.y; y <= imgR.y + imgR.height; y += step) {
            ctx.moveTo(imgR.x, y + 0.5);
            ctx.lineTo(imgR.x + imgR.width, y + 0.5);
        }
        ctx.stroke();
        ctx.restore();

        ctx.font = `12px ${monoFont}`;
        ctx.textAlign = 'center';

        const dragPreview = dragPreviewRef.current;

        // Landmarks — diamond markers
        for (const lm of landmarks) {
            const dragged = dragPreview && dragPreview.sel.kind === 'landmark' && dragPreview.sel.id === lm.id;
            const { x, y } = imageToCanvas({ x: dragged ? dragPreview.x : lm.xPos, y: dragged ? dragPreview.y : lm.yPos }, imgR);
            const isSel = selected?.kind === 'landmark' && selected.id === lm.id;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(Math.PI / 4);
            ctx.beginPath();
            const size = 7.5;
            ctx.rect(-size / 2, -size / 2, size, size);
            ctx.shadowColor = landmarkColor;
            ctx.shadowBlur = 8;
            ctx.fillStyle = landmarkColor;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#1a4a7a';
            ctx.stroke();
            ctx.restore();

            if (isSel) {
                ctx.save();
                ctx.setLineDash([4, 4]);
                ctx.strokeStyle = selectColor;
                ctx.shadowColor = selectColor;
                ctx.shadowBlur = 4;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(x, y, 14, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            ctx.fillStyle = '#dfe3f7';
            ctx.fillText(lm.name, x, y + 20);
        }

        // Systems — star markers
        for (const sys of placed) {
            const dragged = dragPreview && dragPreview.sel.kind === 'system' && dragPreview.sel.id === sys.id;
            const { x, y } = imageToCanvas({ x: dragged ? dragPreview.x : sys.xPos, y: dragged ? dragPreview.y : sys.yPos }, imgR);
            const color = sys.star?.color || (sys.star?.temperatureK != null ? starColor(sys.star.temperatureK) : starFallback);
            const isSel = selected?.kind === 'system' && selected.id === sys.id;

            ctx.beginPath();
            ctx.arc(x, y, 5.5, 0, Math.PI * 2);
            ctx.shadowColor = color;
            ctx.shadowBlur = 9;
            ctx.fillStyle = color;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#7a5a1a';
            ctx.stroke();

            if (isSel) {
                ctx.save();
                ctx.setLineDash([4, 4]);
                ctx.strokeStyle = selectColor;
                ctx.shadowColor = selectColor;
                ctx.shadowBlur = 4;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(x, y, 14, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            ctx.fillStyle = '#dfe3f7';
            ctx.fillText(sys.name, x, y + 20);
        }

        if (placed.length === 0 && landmarks.length === 0) {
            ctx.font = `13px ${monoFont}`;
            ctx.fillStyle = '#7a80ab';
            ctx.textAlign = 'center';
            ctx.fillText('NO CHARTED SYSTEMS', w / 2, h / 2 - 6);
            ctx.font = `11px ${monoFont}`;
            ctx.fillText('nothing plotted yet', w / 2, h / 2 + 12);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [landmarks, placed, selected, colorMode]);

    // Load the background map image once.
    useEffect(() => {
        if (!mapImage) return;
        const img = new Image();
        img.src = mapImage;
        img.onload = () => draw();
        imgRef.current = img;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mapImage]);

    // Redraw on data change / selection / theme.
    useEffect(() => {
        draw();
    }, [draw]);

    // Redraw on resize.
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const observer = new ResizeObserver(() => draw());
        observer.observe(container);
        return () => observer.disconnect();
    }, [draw]);

    const hitTest = useCallback(
        (px: number, py: number, rect: Rect): GalaxySelection | null => {
            let best: { sel: GalaxySelection; dist: number } | null = null;
            for (const sys of placed) {
                const { x, y } = imageToCanvas({ x: sys.xPos, y: sys.yPos }, rect);
                const dist = Math.hypot(x - px, y - py);
                if (dist <= HIT_RADIUS_PX && (!best || dist < best.dist)) {
                    best = { sel: { kind: 'system', id: sys.id }, dist };
                }
            }
            for (const lm of landmarks) {
                const { x, y } = imageToCanvas({ x: lm.xPos, y: lm.yPos }, rect);
                const dist = Math.hypot(x - px, y - py);
                if (dist <= HIT_RADIUS_PX && (!best || dist < best.dist)) {
                    best = { sel: { kind: 'landmark', id: lm.id }, dist };
                }
            }
            return best?.sel ?? null;
        },
        [placed, landmarks]
    );

    // Pointerdown → pointerup bookkeeping for the click-vs-drag decision.
    // Not React state: it changes every pointermove tick during a drag and
    // must never trigger a re-render (same reasoning as the crosshair).
    const pointerRef = useRef<{
        pointerId: number;
        downX: number;
        downY: number;
        hit: GalaxySelection | null;
        dragEligible: boolean;
        dragging: boolean;
    } | null>(null);

    const isPlaced = (sel: GalaxySelection): boolean => {
        if (sel.kind === 'landmark') return true;
        const sys = systems.find((s) => s.id === sel.id);
        return sys != null && sys.xPos !== null && sys.yPos !== null;
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const hit = hitTest(px, py, imageRect(rect.width, rect.height));

        // While armed, every pointer gesture is a placement — never a drag,
        // even if it lands on a different (unrelated) marker.
        const dragEligible = !armedEditable && hit != null && isPlaced(hit) && canEditSelection(hit);

        pointerRef.current = { pointerId: e.pointerId, downX: e.clientX, downY: e.clientY, hit, dragEligible, dragging: false };
        if (dragEligible) container.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const imgR = imageRect(rect.width, rect.height);
        const imgPos = canvasToImage(px, py, imgR);
        const inside = imgPos != null && imgPos.x >= 0 && imgPos.x <= 1 && imgPos.y >= 0 && imgPos.y <= 1;

        // Crosshair hairlines + readout are confined to the image rect (a
        // plotting chart's crosshair belongs to the plot, not its margins):
        // both move together and both hide together the moment the pointer
        // leaves the image, same treatment as leaving the canvas entirely.
        if (inside && imgPos) {
            if (xhVRef.current) {
                xhVRef.current.style.left = `${imgPos.x * 100}%`;
                xhVRef.current.style.opacity = '';
            }
            if (xhHRef.current) {
                xhHRef.current.style.top = `${imgPos.y * 100}%`;
                xhHRef.current.style.opacity = '';
            }
            onCoordsChange(imgPos);
        } else {
            if (xhVRef.current) xhVRef.current.style.opacity = '0';
            if (xhHRef.current) xhHRef.current.style.opacity = '0';
            onCoordsChange(null);
        }

        const pr = pointerRef.current;
        if (pr && pr.dragEligible) {
            const dx = e.clientX - pr.downX;
            const dy = e.clientY - pr.downY;
            if (!pr.dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
                pr.dragging = true;
                setCursor('grabbing');
            }
            if (pr.dragging && pr.hit && imgPos) {
                // Dragging past the image edge naturally pins to the border.
                dragPreviewRef.current = { sel: pr.hit, x: clamp01(imgPos.x), y: clamp01(imgPos.y) };
                draw();
                return;
            }
        }

        // Hover cursor (only relevant when not mid-drag): crosshair while
        // armed, grab over a draggable marker, default otherwise. setCursor
        // bails out on an unchanged value, so this doesn't spam re-renders.
        if (armedEditable) {
            setCursor('crosshair');
        } else {
            const hoverHit = hitTest(px, py, imgR);
            setCursor(hoverHit && isPlaced(hoverHit) && canEditSelection(hoverHit) ? 'grab' : 'default');
        }
    };

    const handlePointerLeave = () => {
        if (xhVRef.current) xhVRef.current.style.opacity = '0';
        if (xhHRef.current) xhHRef.current.style.opacity = '0';
        onCoordsChange(null);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        const container = containerRef.current;
        const pr = pointerRef.current;
        pointerRef.current = null;
        if (!container) return;
        if (pr && container.hasPointerCapture(e.pointerId)) container.releasePointerCapture(e.pointerId);

        const rect = container.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const imgR = imageRect(rect.width, rect.height);
        const raw = canvasToImage(px, py, imgR);

        if (pr?.dragging && pr.hit) {
            dragPreviewRef.current = null;
            setCursor('default');
            // Drag-release always commits, clamped to the image edge — you
            // can't drag a marker "into the letterbox" and lose it.
            if (raw) onPlace(pr.hit, { x: clamp01(raw.x), y: clamp01(raw.y) });
            return;
        }
        dragPreviewRef.current = null;

        // A plain click (no drag). Armed mode places wherever the pointer
        // landed, *unless* that's the letterbox — a click outside the image
        // is ignored outright, not silently clamped onto the border.
        if (armedEditable) {
            if (raw && raw.x >= 0 && raw.x <= 1 && raw.y >= 0 && raw.y <= 1) {
                onPlace(armedEditable, raw);
            }
            return;
        }
        onSelect(hitTest(px, py, imgR));
    };

    // Belt-and-suspenders cleanup: onAnimationEnd normally clears the flash,
    // but prefers-reduced-motion drops the animation entirely (no end event).
    useEffect(() => {
        if (!flash) return;
        const timer = setTimeout(() => setFlash(null), 2400);
        return () => clearTimeout(timer);
    }, [flash]);

    // Base plot summary, plus whatever placement affordance currently
    // applies — the tree/coordinate fields are the actual keyboard path for
    // placing/moving (this label just orients a screen-reader user to what
    // pointer interaction, if any, the canvas itself currently offers.
    const mapAriaLabel = (() => {
        const base = `Galaxy chart: ${placed.length} system${placed.length === 1 ? '' : 's'} and ${landmarks.length} landmark${landmarks.length === 1 ? '' : 's'} plotted.`;
        if (armedEditable) return `${base} Click anywhere on the chart to place the armed marker.`;
        if (currentUserId != null) return `${base} Select an owned system or landmark to move or place it.`;
        return base;
    })();

    return (
        <div
            ref={containerRef}
            className={styles.viewport}
            style={{ width: '100%', height: '100%', minHeight: '26rem', cursor }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            onPointerUp={handlePointerUp}
        >
            <canvas ref={canvasRef} className={styles.canvas} role='img' aria-label={mapAriaLabel} />
            {/* Mirrors the drawn image's rect exactly (set imperatively in
                draw()) so children below can be positioned by simple
                percentage — the same projection the canvas markers use. */}
            <div ref={imageBoxRef} className={styles.imageBox}>
                <div ref={xhVRef} className={`${styles.xh} ${styles.xhV}`} aria-hidden />
                <div ref={xhHRef} className={`${styles.xh} ${styles.xhH}`} aria-hidden />
                {flash && (
                    <div
                        key={flash.key}
                        className={styles.flash}
                        style={{ left: `${flash.x * 100}%`, top: `${flash.y * 100}%` }}
                        aria-hidden
                        onAnimationEnd={() => setFlash(null)}
                    />
                )}
            </div>
            {armedEditable && (
                <p className={styles.armedBanner}>◈ armed — click the map to place</p>
            )}
        </div>
    );
}
