// Local view types for the space console components — shapes specific to the
// slim GET /galaxies/:slug response (not the full StarSystem/Landmark rows in
// src/lib/types.ts, which we don't touch). The full-tree GET /systems/:id
// response DOES match src/lib/types.ts's StarSystem/CelestialBody, so pages
// use those directly.

export interface GalaxyStarSummary {
    temperatureK: number | null;
    color: string | null;
}

export interface GalaxySystemSummary {
    id: number;
    name: string;
    xPos: number | null;
    yPos: number | null;
    creatorId: number;
    star: GalaxyStarSummary | null;
}

export interface GalaxyLandmarkSummary {
    id: number;
    name: string;
    description: string | null;
    xPos: number;
    yPos: number;
    creatorId: number;
}

export interface GalaxyDetail {
    id: number;
    slug: string;
    name: string;
    description: string | null;
    image: string | null;
    systems: GalaxySystemSummary[];
    landmarks: GalaxyLandmarkSummary[];
}

// Selection key shared by the galaxy map (system | landmark) and the system
// diagram (celestial body) — a discriminated union keeps "nothing selected"
// unambiguous from "id 0 selected".
export type GalaxySelection = { kind: 'system'; id: number } | { kind: 'landmark'; id: number };
