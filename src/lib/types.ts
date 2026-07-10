// Domain types mirroring the ff-server Prisma schema (the canonical source of truth).
// Relation fields are optional because the API includes them only on some endpoints.

export type UserRole = 'USER' | 'ADMIN';
export type Sex = 'MALE' | 'FEMALE' | 'OTHER' | 'UNSPECIFIED';
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
    dob: number | null; // equinoxes since the GUY epoch — see lib/guy-time.ts
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
    wikiArticle: string | null;
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
    wikiArticle: string | null;
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
    characterId: number | null;
    wikiArticle: string | null;
    character?: Character;
    creator?: PublicUser;
}
