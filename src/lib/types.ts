// Domain types mirroring the ff-server Prisma schema (the canonical source of truth).
// Relation fields are optional because the API includes them only on some endpoints.

export type UserRole = 'USER' | 'ADMIN';
export type Sex = 'MALE' | 'FEMALE' | 'OTHER' | 'UNSPECIFIED';
export type SentienceClass = 'BLACK' | 'HIGHER_SENTIENT' | 'LOWER_SENTIENT' | 'NON_SENTIENT';
export type MessageType = 'BOT_RESPONSE' | 'COMMAND' | 'QUOTE' | 'ACTION' | 'EMBED' | 'OTHER';
export type ItemType = 'WEAPON' | 'EQUIPMENT' | 'ARTIFACT' | 'OTHER';

export interface PublicUser {
    id: number;
    username: string;
    role: UserRole;
    icon: string | null;
    bio: string | null;
}

export interface Alias {
    id: number;
    name: string;
    characterId: number;
}

export interface Relationship {
    id: number;
    description: string;
    characterId: number;
}

export interface Character {
    id: number;
    name: string;
    dob: number | null; // unix timestamp, displayed in GUY notation
    pob: string | null;
    homePlanet: string | null;
    speciesId: number;
    sex: Sex;
    height: number | null; // meters
    weight: number | null; // kilograms
    hairColor: string | null;
    eyeColor: string | null;
    creatorId: number;
    image: string | null;
    themeColor: string | null;
    blurb: string | null;
    aliases?: Alias[];
    relationships?: Relationship[];
    species?: Species;
    creator?: PublicUser;
}

export interface Species {
    id: number;
    name: string;
    description: string;
    binomialName: string | null;
    class: SentienceClass;
    lifespan: string; // in GUYs
    diet: string | null;
    habitat: string | null;
    placeOfOrigin: string | null;
    creatorId: number;
    Character?: Character[];
}

export interface Season {
    title: string;
    episodes?: Episode[];
}

export interface Episode {
    title: string;
    seasonTitle: string;
    episode_no: number;
    summary: string | null;
    playedDate: string | null;
    messages?: Message[];
}

export interface Message {
    episodeTitle: string;
    messageNo: number;
    playerId: number;
    characterId: number | null;
    timestamp: string | null;
    type: MessageType;
    text: string;
    player?: PublicUser;
    character?: Character;
    commentaries?: Commentary[];
}

export interface Commentary {
    id: number;
    creatorId: number;
    messageEpisodeTitle: string;
    messageNo: number;
    content: string;
    creator?: PublicUser;
}

export interface Item {
    id: number;
    name: string;
    itemType: ItemType;
    description: string;
    image: string | null;
    creatorId: number;
    characterId: number | null;
    character?: Character;
    creator?: PublicUser;
}
