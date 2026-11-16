'use client';

// The galaxy map's state: the places (loaded by the page, then kept in step with
// ff-server through /site/ff/galaxy), the selection, and the view settings.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from '@/components/auth/SessionProvider';
import { designate, fromApi, loadTerritories } from './data';
import type { ApiBody, ApiPlace, Body, BodyKind, Place, Precision, RegionKey, Vec3 } from './data';
import type { Layers, ViewMode } from './GalaxyScene';
import { episodeNumberLabel, seasonOrder } from '@/lib/seasons';
import type { Season } from '@/lib/types';

/** An episode the travelogue picker can offer. */
export interface EpisodeChoice {
    slug: string;
    /** "FF2 episode 4, Shady Business" */
    label: string;
}

async function call<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
    const res = await fetch(`/site/ff/galaxy${path}`, {
        method,
        ...(body !== undefined && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    });
    if (res.status === 204) return undefined as T;
    const json = (await res.json().catch(() => null)) as { status?: string; message?: string; data?: T } | null;
    if (!res.ok || json?.status !== 'success') {
        throw new Error(res.status === 401 ? 'Sign in to change the map.' : (json?.message ?? `The map could not be changed (HTTP ${res.status}).`));
    }
    return json.data as T;
}

/** Where a place goes, as ff-server stores it. */
export interface Where {
    pos: Vec3;
    precision: Precision;
    regionHint?: RegionKey;
}

const whereFields = (w: Where) => ({
    x: w.pos[0],
    y: w.pos[1],
    z: w.pos[2],
    region: w.precision === 'region' && w.regionHint ? w.regionHint.toUpperCase() : null,
});

/** A body as sent to ff-server; `children` only when it goes up with a new system. */
export interface NewBody {
    kind: BodyKind;
    name: string | null;
    type: string;
    radiusKm?: number;
    orbit?: number;
    /** Planets: "this is planet N". */
    ordinal?: number | null;
    children?: NewBody[];
}

const bodyFields = (b: NewBody): Record<string, unknown> => ({
    kind: b.kind.toUpperCase(),
    name: b.name,
    type: b.type,
    ...(b.kind !== 'star' && { radiusKm: b.radiusKm, orbit: b.orbit }),
    ...(b.kind === 'planet' && b.ordinal && { ordinal: b.ordinal }),
    ...(b.children && { children: b.children.map(bodyFields) }),
});

/** The written parts of a place or body; "" clears a description or slug. */
export interface TextPatch {
    name?: string;
    description?: string;
    slug?: string;
}

type BodyPatch = Partial<Pick<Body, 'type' | 'radiusKm' | 'orbit' | 'ordinal'>>;

/** localStorage: the view settings (camera, layers, starfield strength, orbit motion). */
const VIEW_KEY = 'galaxyView';
export const DEFAULT_SKY = 0.25;

export function useGalaxyStore(initial: ApiPlace[]) {
    const { user } = useSession();
    const [places, setPlaces] = useState<Place[]>(() => initial.map(fromApi));
    const [selPlaceId, setSelPlaceId] = useState<number | null>(null);
    const [selBodyId, setSelBodyId] = useState<number | null>(null);
    const [level, setLevel] = useState<'galaxy' | 'system'>('galaxy');
    const [view, setView] = useState<ViewMode>('tilt');
    const [layers, setLayers] = useState<Layers>({ galaxy: true, territories: true, rim: true, grid: true, octants: false, bearings: true, labels: true, transit: false });
    // How strongly the starfield shows behind the map, 0 to 1 (full strength is dizzying to turn in)
    const [sky, setSky] = useState(DEFAULT_SKY);
    // Bodies travel round their orbits in the system view
    const [motion, setMotion] = useState(true);
    const [restored, setRestored] = useState(false);
    const [flyToken, setFlyToken] = useState(0);
    const [resetToken, setResetToken] = useState(0);
    const [placing, setPlacing] = useState(false);
    const [still, setStill] = useState(false);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [episodes, setEpisodes] = useState<EpisodeChoice[] | null>(null);
    const episodesAsked = useRef(false);
    const placeCb = useRef<((pos: Vec3) => void) | null>(null);
    // Slider edits to a body are sent once the member stops dragging
    const pending = useRef(new Map<number, { patch: BodyPatch; timer: ReturnType<typeof setTimeout> }>());

    useEffect(() => {
        void loadTerritories().then(() => setReady(true));
        // The view settings as this browser last left them (after the first paint, which the server drew without them)
        queueMicrotask(() => {
        let saved: Partial<{ view: unknown; layers: unknown; sky: unknown; motion: unknown }> = {};
        try {
            saved = JSON.parse(localStorage.getItem(VIEW_KEY) ?? '{}') ?? {};
        } catch {
            // Unreadable or blocked storage: the defaults stand
        }
        // Phones and other touch-first devices start in the cheaper flat view.
        if (saved.view === 'tilt' || saved.view === 'top') setView(saved.view);
        else if (window.matchMedia('(pointer: coarse), (max-width: 700px)').matches) setView('top');
        const kept = saved.layers;
        if (kept && typeof kept === 'object') {
            setLayers((now) => {
                const next = { ...now };
                for (const key of Object.keys(now) as (keyof Layers)[]) {
                    const on = (kept as Record<string, unknown>)[key];
                    if (typeof on === 'boolean') next[key] = on;
                }
                return next;
            });
        }
        if (typeof saved.sky === 'number' && saved.sky >= 0 && saved.sky <= 1) setSky(saved.sky);
        if (typeof saved.motion === 'boolean') setMotion(saved.motion);
        else if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setMotion(false);
        setRestored(true);
        });
    }, []);

    useEffect(() => {
        if (!restored) return;
        try {
            localStorage.setItem(VIEW_KEY, JSON.stringify({ view, layers, sky, motion }));
        } catch {
            // Not kept, then
        }
    }, [restored, view, layers, sky, motion]);

    const selPlace = places.find((p) => p.id === selPlaceId) ?? null;
    const selBody = selPlace?.bodies.find((b) => b.id === selBodyId) ?? null;

    const select = useCallback((placeId: number | null, bodyId: number | null = null) => {
        setSelPlaceId(placeId);
        setSelBodyId(bodyId);
        if (!placeId) setLevel('galaxy');
        else setFlyToken((n) => n + 1);
    }, []);

    const putPlace = (api: ApiPlace): Place => {
        const place = fromApi(api);
        setPlaces((all) => (all.some((p) => p.id === place.id) ? all.map((p) => (p.id === place.id ? place : p)) : [...all, place]));
        return place;
    };

    /** Runs one change against ff-server; a failure is shown, and answers null. */
    async function attempt<T>(change: () => Promise<T>): Promise<T | null> {
        try {
            const result = await change();
            setError(null);
            return result;
        } catch (e) {
            setError(e instanceof Error ? e.message : 'The map could not be changed.');
            return null;
        }
    }

    const refreshPlace = (id: number) => attempt(async () => putPlace(await call<ApiPlace>('GET', `/places/${id}`)));

    const sendBody = (placeId: number, bodyId: number) => {
        const entry = pending.current.get(bodyId);
        if (!entry) return;
        pending.current.delete(bodyId);
        void attempt(() => call<ApiBody>('PATCH', `/bodies/${bodyId}`, entry.patch)).then((saved) => {
            // Refused: show what the server still has
            if (!saved) void refreshPlace(placeId);
        });
    };

    return {
        user,
        /** The place's creator or an admin (ff-server enforces it; this only hides controls). */
        canEdit: (place: Place) => !!user && (user.role === 'ADMIN' || user.id === place.owner.id),
        ready,
        /** The browser has no WebGL: the map is a still picture, with no camera and no layers to switch. */
        still,
        setStill: useCallback(() => setStill(true), []),
        error,
        clearError: () => setError(null),
        places,
        selPlace,
        selBody,
        level,
        view,
        setView,
        layers,
        setLayers,
        sky,
        setSky,
        motion,
        setMotion,
        flyToken,
        resetToken,
        resetView: () => setResetToken((n) => n + 1),
        placing,
        select,
        openSystem(placeId: number, bodyId: number | null = null) {
            select(placeId, bodyId);
            setLevel('system');
        },
        closeSystem() {
            setLevel('galaxy');
            setSelBodyId(null);
        },
        requestPlace(cb: (pos: Vec3) => void) {
            placeCb.current = cb;
            setLevel('galaxy');
            setPlacing(true);
        },
        cancelPlace() {
            placeCb.current = null;
            setPlacing(false);
        },
        handlePlace(pos: Vec3) {
            placeCb.current?.(pos);
            placeCb.current = null;
            setPlacing(false);
        },
        /** A new landmark, or a new system with its star (`bodies: [star]`); `name` null = not named yet. */
        addPlace(p: { kind: 'system' | 'landmark'; name: string | null; where: Where; category?: string; star?: NewBody }) {
            return attempt(async () =>
                putPlace(
                    await call<ApiPlace>('POST', '/places', {
                        kind: p.kind.toUpperCase(),
                        name: p.name,
                        ...whereFields(p.where),
                        ...(p.category && { category: p.category }),
                        ...(p.star && { bodies: [bodyFields(p.star)] }),
                    }),
                ),
            );
        },
        movePlace(id: number, where: Where) {
            return attempt(async () => putPlace(await call<ApiPlace>('PATCH', `/places/${id}`, whereFields(where))));
        },
        renamePlace(id: number, name: string) {
            return attempt(async () => putPlace(await call<ApiPlace>('PATCH', `/places/${id}`, { name })));
        },
        /** Name, description, wiki slug or (landmarks) category. Answers whether ff-server took it. */
        async editPlace(id: number, fields: TextPatch & { category?: string }) {
            return (await attempt(async () => putPlace(await call<ApiPlace>('PATCH', `/places/${id}`, fields)))) !== null;
        },
        async editBody(placeId: number, bodyId: number, fields: TextPatch) {
            if ((await attempt(() => call<ApiBody>('PATCH', `/bodies/${bodyId}`, fields))) === null) return false;
            await refreshPlace(placeId);
            return true;
        },
        async removePlace(id: number) {
            if ((await attempt(() => call<void>('DELETE', `/places/${id}`).then(() => true))) === null) return;
            setPlaces((all) => all.filter((p) => p.id !== id));
            select(null);
        },
        /** Adds a body under `parentId`; answers its id. */
        async addBody(placeId: number, parentId: number, b: NewBody): Promise<number | null> {
            const made = await attempt(() => call<ApiBody>('POST', `/places/${placeId}/bodies`, { ...bodyFields(b), parentId }));
            if (!made) return null;
            await refreshPlace(placeId);
            return made.id;
        },
        /** Shown at once; sent when the edits pause. */
        updateBody(placeId: number, bodyId: number, patch: BodyPatch) {
            setPlaces((all) => all.map((p) => (p.id === placeId ? { ...p, bodies: designate(p.bodies.map((b) => (b.id === bodyId ? { ...b, ...patch } : b))) } : p)));
            const before = pending.current.get(bodyId);
            if (before) clearTimeout(before.timer);
            pending.current.set(bodyId, { patch: { ...before?.patch, ...patch }, timer: setTimeout(() => sendBody(placeId, bodyId), 500) });
        },
        /** Every episode in archive order, for the travelogue picker; null until `loadEpisodes` has answered. */
        episodes,
        loadEpisodes() {
            if (episodesAsked.current) return;
            episodesAsked.current = true;
            void attempt(async () => {
                const res = await fetch('/site/ff/seasons');
                const json = (await res.json().catch(() => null)) as { data?: Season[] } | null;
                if (!res.ok || !json?.data) throw new Error('The episode list could not be loaded.');
                const seasons = [...json.data].sort((a, b) => {
                    const [x, y] = [seasonOrder(a.title), seasonOrder(b.title)];
                    return x[0] - y[0] || x[1].localeCompare(y[1]);
                });
                setEpisodes(
                    seasons.flatMap((season) => {
                        const all = [...(season.episodes ?? [])].sort((a, b) => a.episode_no - b.episode_no);
                        return all.map((e) => ({ slug: e.slug, label: `${season.title} episode ${episodeNumberLabel(e, all)}, ${e.title}` }));
                    }),
                );
            }).then((ok) => {
                // Failed: the next open of the picker asks again
                if (ok === null) episodesAsked.current = false;
            });
        },
        /** Tags an episode on a place, or on one of its bodies. */
        async tagEpisode(placeId: number, bodyId: number | null, episode: string) {
            const made = await attempt(() => call<unknown>('POST', `/places/${placeId}/travelogue`, { episode, bodyId }));
            if (made === null) return false;
            await refreshPlace(placeId);
            return true;
        },
        async untagEpisode(placeId: number, tagId: number) {
            if ((await attempt(() => call<void>('DELETE', `/travelogue/${tagId}`).then(() => true))) === null) return;
            await refreshPlace(placeId);
        },
        async removeBody(placeId: number, bodyId: number) {
            if ((await attempt(() => call<void>('DELETE', `/bodies/${bodyId}`).then(() => true))) === null) return;
            setSelBodyId(null);
            await refreshPlace(placeId);
        },
    };
}

export type Store = ReturnType<typeof useGalaxyStore>;
