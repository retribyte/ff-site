// Domain types mirroring the ff-server Prisma schema (the canonical source of truth).
// Relation fields are optional because the API includes them only on some endpoints.

export type UserRole = 'USER' | 'ADMIN';
export type SentienceClass = 'BLACK' | 'HIGHER_SENTIENT' | 'LOWER_SENTIENT' | 'NON_SENTIENT';
export type MessageType = 'BOT_RESPONSE' | 'COMMAND' | 'QUOTE' | 'ACTION' | 'EMBED' | 'OTHER';
export type ItemType = 'WEAPON' | 'EQUIPMENT' | 'ARTIFACT' | 'OTHER';
export type StoryLineType = 'NARRATION' | 'DIALOGUE' | 'ACTION' | 'TRANSCRIPT' | 'BREAK' | 'HEADING';
export type StoryFormat = 'SCRIPT' | 'PROSE';
export type EightBallAnswerType = 'YES' | 'NO' | 'MAYBE';

export interface PublicUser {
    id: number;
    username: string;
    role: UserRole;
    icon: string | null;
    bio: string | null;
}

export interface Character {
    id: number;
    name: string;
    speciesId: number;
    creatorId: number;
    image: string | null;
    color: string | null;
    blurb: string | null;
    slug: string;
    species?: Species;
    creator?: PublicUser;
    personas?: Persona[];
    wiki?: WikiCharacterData | null;
}

// Bucket data pulled from the wiki's Character infobox, cached server-side
// (ff-server's WikiCache). All fields optional — only present if the wiki
// page actually set them. Unrelated to the DB `Persona` concept below:
// `aliases` here is wiki-page nicknames, not presentation eras.
export interface WikiCharacterData {
    fullname?: string;
    aliases?: string[];
    faction?: string;
    birthdate?: string;
    birthplace?: string;
    deathdate?: string;
    deathcause?: string;
    relationship?: string[];
    planet?: string[];
    sex?: string;
    height?: string;
    weight?: string;
    hair?: string;
    eyes?: string;
}

// A way a character is presented for some stretch of the archive: a
// different name, a different look, or both. `name` is nullable — a
// look-only persona (new avatar/color, same name) has no name opinion.
// `label` is the admin-facing handle for distinguishing name-less personas
// in editing UI; it's never rendered in transcripts.
export interface Persona {
    id: number;
    name: string | null;
    label: string | null;
    slug: string | null;
    image: string | null;
    color: string | null;
    characterId: number;
}

export interface Species {
    id: number;
    name: string;
    description: string;
    class: SentienceClass;
    creatorId: number;
    slug: string;
    Character?: Character[];
    wiki?: WikiSpeciesData | null;
}

// Bucket data pulled from the wiki's Species infobox, cached server-side.
export interface WikiSpeciesData {
    union_name?: string;
    faction?: string;
    lifespan?: string;
    diet?: string;
    procreation_method?: string;
    habitat?: string;
    homeworld?: string;
    religion?: string;
    government?: string;
    technology_progression?: string;
}

export interface Season {
    title: string;
    slug: string;
    episodes?: Episode[];
}

export interface Episode {
    title: string;
    seasonTitle: string;
    episode_no: number;
    summary: string | null;
    playedDate: string | null;
    slug: string;
    messages?: Message[];
}

export interface Message {
    episodeTitle: string;
    messageNo: number;
    playerId: number;
    characterId: number | null;
    personaId: number | null;
    timestamp: string | null;
    type: MessageType;
    text: string;
    player?: PublicUser;
    character?: Character;
    persona?: { id: number; name: string | null; image: string | null; color: string | null } | null;
    episode?: Episode;
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

export interface StorySegment {
    text: string;
    characterId?: number | null;
    speaker?: string | null;
    italic?: boolean;
    bold?: boolean;
}

export interface Story {
    id: number;
    slug: string;
    title: string;
    blurb: string | null;
    authorId: number | null;
    publishedDate: string | null;
    themeColor: string | null;
    themeColor2: string | null;
    format: StoryFormat;
    author?: PublicUser;
    chapters?: StoryChapter[];
}

export interface StoryChapter {
    id: number;
    storyId: number;
    chapter_no: number;
    title: string | null;
    lines?: StoryLine[];
    _count?: { lines: number };
}

export interface StoryLine {
    id: number;
    chapterId: number;
    line_no: number;
    type: StoryLineType;
    text: string;
    characterId: number | null;
    speaker: string | null; // display-name fallback when no Character row exists
    segments?: StorySegment[] | null; // sub-paragraph dialogue spans (NARRATION only); concat === text
    character?: Character;
}

export interface EightBallAnswer {
    id: number;
    type: EightBallAnswerType;
    text: string;
}

// A StoryLine where this character speaks — either as the line's own
// characterId (whole DIALOGUE line) or inside a segment (inline quote in a
// NARRATION paragraph) — with enough story/chapter context to link back.
export interface StoryQuote {
    id: number;
    chapterId: number;
    line_no: number;
    type: StoryLineType;
    text: string;
    characterId: number | null;
    speaker: string | null;
    segments: StorySegment[] | null;
    storySlug: string;
    storyTitle: string;
    chapterNo: number;
}

// Response shape of GET /characters/:id/quotes — two sources with no shared
// sort key (message timestamp vs. story/chapter/line position), kept separate.
export interface CharacterQuotes {
    messages: Message[];
    storyQuotes: StoryQuote[];
}

export interface Item {
    id: number;
    name: string;
    itemType: ItemType;
    description: string;
    image: string | null;
    creatorId: number;
    slug: string;
    creator?: PublicUser;
    wiki?: WikiItemData | null;
}

// Bucket data pulled from the wiki's Item infobox, cached server-side.
export interface WikiItemData {
    value?: string;
    market_value_free?: string;
    faction?: string;
    rarity?: string;
    type?: string;
    use?: string;
    damage?: string;
    armor?: string;
    character?: string;
    age?: string;
    location?: string;
}
