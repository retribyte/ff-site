// Pure tree-mutation helpers for SystemBuilder's local state. The domain is
// fixed at three levels (star → planets → moons) — the server itself
// enforces exactly that shape — so these are written explicitly rather than
// as generic recursive tree ops; that keeps "delete a planet drops its
// moons" and "there's exactly one star" obvious from the code shape.
import type { BodyComposition, CelestialBody, CelestialBodyType } from '@/lib/types';

/** Fields collected by BodyForm — everything except identity/nesting, which
 *  the caller (SystemBuilder) supplies. */
export interface BodyDraft {
    name: string;
    radiusKm: number;
    distance: number | null; // AU for planets, km for moons, null for the star
    composition: BodyComposition | null; // null for the star
    temperatureK: number | null; // star only
    color: string | null;
    description: string | null;
    wikiArticle: string | null;
}

export function draftToBody(
    id: number,
    systemId: number,
    parentId: number | null,
    type: CelestialBodyType,
    draft: BodyDraft
): CelestialBody {
    return {
        id,
        systemId,
        parentId,
        type,
        name: draft.name,
        radiusKm: draft.radiusKm,
        distance: draft.distance,
        composition: draft.composition,
        temperatureK: draft.temperatureK,
        color: draft.color,
        description: draft.description,
        wikiArticle: draft.wikiArticle,
        children: [],
    };
}

export function findBody(star: CelestialBody | null, id: number): CelestialBody | null {
    if (!star) return null;
    if (star.id === id) return star;
    for (const child of star.children ?? []) {
        if (child.id === id) return child;
        for (const grandchild of child.children ?? []) {
            if (grandchild.id === id) return grandchild;
        }
    }
    return null;
}

export function addPlanet(star: CelestialBody, planet: CelestialBody): CelestialBody {
    return { ...star, children: [...(star.children ?? []), planet] };
}

export function addMoon(star: CelestialBody, planetId: number, moon: CelestialBody): CelestialBody {
    return {
        ...star,
        children: (star.children ?? []).map((planet) =>
            planet.id === planetId ? { ...planet, children: [...(planet.children ?? []), moon] } : planet
        ),
    };
}

/** Applies `patch` to whichever node (star/planet/moon) matches id, preserving its children. */
export function updateBody(star: CelestialBody, id: number, patch: BodyDraft): CelestialBody {
    const apply = (body: CelestialBody): CelestialBody => ({ ...body, ...patch });
    if (star.id === id) return apply(star);
    return {
        ...star,
        children: (star.children ?? []).map((planet) =>
            planet.id === id
                ? apply(planet)
                : {
                      ...planet,
                      children: (planet.children ?? []).map((moon) => (moon.id === id ? apply(moon) : moon)),
                  }
        ),
    };
}

/** Removes a planet (and its moons with it) or a moon. Removing the star itself is the
 *  caller's job (clears the whole tree back to `null`) — not expressible as a subtree removal. */
export function removeBody(star: CelestialBody, id: number): CelestialBody {
    return {
        ...star,
        children: (star.children ?? [])
            .filter((planet) => planet.id !== id)
            .map((planet) => ({ ...planet, children: (planet.children ?? []).filter((moon) => moon.id !== id) })),
    };
}

export interface BodyPayload {
    name: string;
    radiusKm: number;
    color?: string | null;
    description?: string | null;
    wikiArticle?: string | null;
}

export interface WholeTreePayload {
    star: BodyPayload & {
        temperatureK: number | null;
        planets: (BodyPayload & {
            distance: number;
            composition: BodyComposition;
            moons: (BodyPayload & { distance: number; composition: BodyComposition })[];
        })[];
    };
}

/** Local tree → the whole-tree PUT /systems/:id/bodies payload shape. */
export function serializeTree(star: CelestialBody): WholeTreePayload {
    return {
        star: {
            name: star.name,
            radiusKm: star.radiusKm,
            temperatureK: star.temperatureK,
            color: star.color,
            description: star.description,
            wikiArticle: star.wikiArticle,
            planets: (star.children ?? []).map((planet) => ({
                name: planet.name,
                radiusKm: planet.radiusKm,
                distance: planet.distance ?? 0,
                composition: planet.composition ?? 'TERRESTRIAL',
                color: planet.color,
                description: planet.description,
                wikiArticle: planet.wikiArticle,
                moons: (planet.children ?? []).map((moon) => ({
                    name: moon.name,
                    radiusKm: moon.radiusKm,
                    distance: moon.distance ?? 0,
                    composition: moon.composition ?? 'TERRESTRIAL',
                    color: moon.color,
                    description: moon.description,
                    wikiArticle: moon.wikiArticle,
                })),
            })),
        },
    };
}
