'use client';

// PROTOTYPE, throwaway. All state is in memory; a reload resets it.

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadTerritories, newId, seedPlaces } from './data';
import type { Body, Episode, Place, Vec3 } from './data';
import type { Layers, ViewMode } from './GalaxyScene';

export function useGalaxyStore() {
    const [places, setPlaces] = useState<Place[]>(seedPlaces);
    const [selPlaceId, setSelPlaceId] = useState<string | null>(null);
    const [selBodyId, setSelBodyId] = useState<string | null>(null);
    const [level, setLevel] = useState<'galaxy' | 'system'>('galaxy');
    const [view, setView] = useState<ViewMode>('tilt');
    const [layers, setLayers] = useState<Layers>({ galaxy: true, territories: true, rim: true, grid: true, octants: false, bearings: true, labels: true });
    const [flyToken, setFlyToken] = useState(0);
    const [resetToken, setResetToken] = useState(0);
    const [placing, setPlacing] = useState(false);
    const [ready, setReady] = useState(false);
    const placeCb = useRef<((pos: Vec3) => void) | null>(null);

    useEffect(() => {
        loadTerritories().then(() => {
            setReady(true);
            // Phones and other touch-first devices start in the cheaper flat view.
            if (window.matchMedia('(pointer: coarse), (max-width: 700px)').matches) setView('top');
        });
    }, []);

    const selPlace = places.find((p) => p.id === selPlaceId) ?? null;
    const selBody = selPlace?.bodies.find((b) => b.id === selBodyId) ?? null;

    const select = useCallback((placeId: string | null, bodyId: string | null = null) => {
        setSelPlaceId(placeId);
        setSelBodyId(bodyId);
        if (!placeId) setLevel('galaxy');
        else setFlyToken((n) => n + 1);
    }, []);

    const patchPlace = (id: string, fn: (p: Place) => Place) => setPlaces((all) => all.map((p) => (p.id === id ? fn(p) : p)));

    return {
        me: 'Trey',
        ready,
        places,
        selPlace,
        selBody,
        level,
        view,
        setView,
        layers,
        setLayers,
        flyToken,
        resetToken,
        resetView: () => setResetToken((n) => n + 1),
        placing,
        select,
        openSystem(placeId: string, bodyId: string | null = null) {
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
        addPlace(p: Omit<Place, 'id'>): Place {
            const place = { ...p, id: newId('p') };
            setPlaces((all) => [...all, place]);
            return place;
        },
        movePlace(id: string, patch: Pick<Place, 'pos' | 'precision' | 'regionHint'>) {
            patchPlace(id, (p) => ({ ...p, ...patch }));
        },
        renamePlace(id: string, name: string) {
            patchPlace(id, (p) => ({ ...p, name, placeholder: false, bodies: p.bodies.map((b) => (b.kind === 'star' && b.name === 'Unnamed star' ? { ...b, name } : b)) }));
        },
        removePlace(id: string) {
            setPlaces((all) => all.filter((p) => p.id !== id));
            select(null);
        },
        addBody(placeId: string, b: Omit<Body, 'id'>): Body {
            const body = { ...b, id: newId('b') };
            patchPlace(placeId, (p) => ({ ...p, bodies: [...p.bodies, body] }));
            return body;
        },
        updateBody(placeId: string, bodyId: string, patch: Partial<Body>) {
            patchPlace(placeId, (p) => ({ ...p, bodies: p.bodies.map((b) => (b.id === bodyId ? { ...b, ...patch } : b)) }));
        },
        removeBody(placeId: string, bodyId: string) {
            patchPlace(placeId, (p) => ({ ...p, bodies: p.bodies.filter((b) => b.id !== bodyId && b.parentId !== bodyId) }));
            setSelBodyId(null);
        },
        tagEpisode(placeId: string, bodyId: string | null, episode: Episode) {
            patchPlace(placeId, (p) =>
                bodyId ? { ...p, bodies: p.bodies.map((b) => (b.id === bodyId ? { ...b, travelogue: [...b.travelogue, episode] } : b)) } : { ...p, travelogue: [...p.travelogue, episode] },
            );
        },
    };
}

export type Store = ReturnType<typeof useGalaxyStore>;
