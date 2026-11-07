// Domain types mirroring the ff-server Prisma schema (the canonical source of truth).
// Relation fields are optional because the API includes them only on some endpoints.

export type UserRole = 'USER' | 'ADMIN';
export type MessageType = 'BOT_RESPONSE' | 'COMMAND' | 'QUOTE' | 'ACTION' | 'EMBED' | 'OTHER';
export type ItemType = 'WEAPON' | 'EQUIPMENT' | 'ARTIFACT' | 'OTHER';
export type StoryLineType = 'NARRATION' | 'DIALOGUE' | 'ACTION' | 'TRANSCRIPT' | 'BREAK' | 'HEADING' | 'IMAGE';
export type StoryFormat = 'SCRIPT' | 'PROSE';
export type EightBallAnswerType = 'YES' | 'NO' | 'MAYBE';

export interface PublicUser {
    id: number;
    username: string;
    role: UserRole;
    icon: string | null;
    // dark-mode display color for characterless messages (e.g. the Vortox bot)
    color?: string | null;
    bio: string | null;
}

/** GET /users/:idOrUsername — the public profile page's payload */
export interface UserProfile extends PublicUser {
    iconBooruId: number | null;
    wikiUser: string | null;
    createdAt: string;
    /** Still on the seeded/reset password: has never signed in as themselves */
    inactive: boolean;
    characters: { id: number; name: string; slug: string; image: string | null; color: string | null; colorLight?: string | null; seasons?: string[]; quoteCount?: number }[];
    stories: { id: number; slug: string; title: string; publishedDate: string | null }[];
    _count: { messages: number; commentaries: number };
}

export interface Character {
    id: number;
    name: string;
    creatorId: number;
    image: string | null;
    /** Dark-mode color; resolve display colors with characterColor() */
    color: string | null;
    /** Light-mode override; null = derived from `color` */
    colorLight?: string | null;
    blurb: string | null;
    slug: string;
    creator?: PublicUser;
    seasons?: string[];
    /** GET /characters only: QUOTE messages plus story lines spoken */
    quoteCount?: number;
    /** GET /characters only: words across those quotes (in a story paragraph, only the character's own spans) */
    quoteWordCount?: number;
    /** GET /characters only: first appearance per campaign */
    appearances?: CharacterAppearance[];
    personas?: Persona[];
    wiki?: WikiData | null;
    /** Campaigns an admin added this character to the cast of (see SeasonCast) */
    mainIn?: Pick<Season, 'title' | 'slug'>[];
}

// A record's row from the wiki's Bucket store, cached server-side
// (ff-server's WikiCache). Whatever fields the wiki's schema has, minus the
// ones ff-server excludes (images) — the site doesn't fix the set, so render
// it with wikiFacts() rather than reading fields by name. Repeated fields
// arrive as string[]. (A character's `aliases` here are wiki-page nicknames,
// unrelated to the DB Persona concept.)
export type WikiValue = string | string[] | number | boolean | null;
export type WikiData = Record<string, WikiValue>;

// A way a character is presented for some stretch of the archive: a
// different name, a different look, or both. `name` is nullable — a
// look-only persona (new avatar/color, same name) has no name opinion.
// `label` is the admin-facing handle for distinguishing name-less personas
// in editing UI; it's never rendered in transcripts. `characterId` null is
// an NPC voice ("Enemy A"): always named, no slug or page, admin-managed,
// and its lines have no character.
export interface Persona {
    id: number;
    name: string | null;
    label: string | null;
    slug: string | null;
    image: string | null;
    color: string | null;
    characterId: number | null;
}

// An NPC voice as listed for admins (GET /personas?npc=true).
export interface NpcPersona extends Persona {
    name: string;
    characterId: null;
    messageCount: number;
}

/**
 * Where a character first turns up in one campaign: an episode and message,
 * or (both null) only in a story. `season: null` = a story outside any campaign.
 */
export interface CharacterAppearance {
    season: string | null;
    episodeNo: number | null;
    messageNo: number | null;
    /** From a reconstructed episode: only when the campaign has no archived one with this character */
    reconstructed?: boolean;
}

export type SeasonKind = 'MAINLINE' | 'SIDE' | 'PLANNED';

export interface Season {
    title: string;
    slug: string;
    kind?: SeasonKind;
    episodes?: Episode[];
    stories?: Pick<Story, 'slug' | 'title' | 'blurb' | 'themeColor' | 'themeColor2'>[];
}

/** GET /seasons/:season/cast: a campaign's player characters (see ff-server getSeasonCast) */
export interface SeasonCast {
    season: string;
    /** Most messages in the campaign first */
    characters: (Pick<Character, 'id' | 'name' | 'slug' | 'image' | 'color' | 'colorLight'> & {
        messageCount: number;
        /** Episodes it was its player's most active character in */
        topEpisodes: number;
        /** Added by an admin (Character.mainIn) rather than found from the transcripts */
        manual: boolean;
    })[];
    /** Episode title -> ids of the characters that led it, most messages first */
    byEpisode: Record<string, number[]>;
}

export interface Episode {
    title: string;
    seasonTitle: string;
    episode_no: number;
    summary: string | null;
    playedDate: string | null;
    slug: string;
    /** Rewritten from memory, not recovered from logs (FF1's lost episodes) */
    reconstructed?: boolean;
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
    /** An NPC voice: `speaker` is its name, absent while unnamed (still dialogue, not narration) */
    npc?: boolean;
    italic?: boolean;
    bold?: boolean;
}

export interface Story {
    id: number;
    slug: string;
    title: string;
    blurb: string | null;
    publishedDate: string | null;
    themeColor: string | null;
    themeColor2: string | null;
    format: StoryFormat;
    /** false = outside the universe's continuity (a joke, a what-if) */
    canon: boolean;
    seasonTitle?: string | null;
    season?: Pick<Season, 'title' | 'slug' | 'kind'> | null;
    /** GET /stories and /stories/:slug: words of prose (not breaks or pictures) */
    wordCount?: number;
    authors?: PublicUser[];
    chapters?: StoryChapter[];
}

export interface StoryChapter {
    id: number;
    storyId: number;
    chapter_no: number;
    title: string | null;
    lines?: StoryLine[];
    _count?: { lines: number };
    wordCount?: number;
}

export interface StoryLine {
    id: number;
    chapterId: number;
    line_no: number;
    type: StoryLineType;
    text: string;
    characterId: number | null;
    speaker: string | null; // display-name fallback when no Character row exists
    npcVoice?: boolean; // DIALOGUE: an NPC voice, named by `speaker` or unnamed (null)
    segments?: StorySegment[] | null; // sub-paragraph dialogue spans (NARRATION only); concat === text
    booruId?: number | null; // IMAGE: the booru post holding the picture (text is its alt text)
    imageUrl?: string | null; // IMAGE: that post's file URL (load it through imageSrc)
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
    /** The story's season title, or null when it's filed under none */
    storySeason?: string | null;
    chapterNo: number;
}

// Response shape of GET /characters/:id/quotes — two sources with no shared
// sort key (message timestamp vs. story/chapter/line position), kept separate.
export interface CharacterQuotes {
    messages: Message[];
    storyQuotes: StoryQuote[];
}

/** An episode line a character speaks, as a link target (GET /characters/:id/appearances) */
export interface AppearanceEpisode {
    title: string;
    slug: string;
    episodeNo: number;
    messageNo: number;
    reconstructed: boolean;
}

/** Response shape of GET /characters/:id/appearances */
export interface CharacterAppearances {
    /** One per campaign the character speaks in (any message type) */
    campaigns: {
        season: string;
        slug: string;
        kind: SeasonKind;
        episodes: number;
        /** Episodes in the whole campaign */
        seasonEpisodes: number;
        messages: number;
        /** Archived episodes before reconstructed ones */
        first: AppearanceEpisode;
        last: AppearanceEpisode;
    }[];
    /** Up to 6, most shared episodes + stories first */
    costars: (Pick<Character, 'id' | 'name' | 'slug' | 'image' | 'color' | 'colorLight'> & {
        episodes: number;
        stories: number;
    })[];
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
    wiki?: WikiData | null;
}

export type JobStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED';

/** One run of an admin job (GET /admin/job-runs; `log` only on a single run or a run's response) */
export interface JobRun {
    id: number;
    job: string;
    dryRun: boolean;
    status: JobStatus;
    summary: string | null;
    log?: string;
    startedAt: string;
    finishedAt: string | null;
    user: { id: number; username: string } | null;
}

/** One ff-server log entry (GET /admin/logs); other fields depend on `event` */
export interface LogEntry {
    time: string;
    level: 'debug' | 'info' | 'warn' | 'error';
    event: string;
    msg?: string;
    reqId?: string;
    userId?: number;
    username?: string;
    [field: string]: unknown;
}

/** GET /admin/jobs: a maintenance job and its latest run */
export interface AdminJob {
    name: string;
    title: string;
    description: string;
    lastRun: JobRun | null;
}

/** POST /admin/episode-import/preview: what importing these episodes would do */
export interface EpisodeImportPlan {
    episodes: {
        title: string;
        seasonTitle: string;
        episodeNo: number;
        reconstructed: boolean;
        messages: number;
        newSeason: boolean;
        conflicts: string[];
    }[];
    missingPlayers: string[];
    newNpcVoices: string[];
    newPersonas: { character: string; name: string }[];
    caseMatches: { speaker: string; character: string }[];
    ok: boolean;
}
