'use client';

import { useSyncExternalStore } from 'react';

// Story bookmarks: one per story, kept only in this browser (localStorage
// key `storyBookmarks`, a JSON map of story slug -> position). A position is
// chapter * 100000 + line, so later lines always compare greater, even in a
// single chapter of thousands of lines (Vortox Machina's has 3,293).

const KEY = 'storyBookmarks';
const CHANGE = 'storybookmarkchange';
const CHAPTER = 100000;

export interface BookmarkSpot {
    chapter: number;
    line: number;
}

export function bookmarkPosition(chapter: number, line: number): number {
    return chapter * CHAPTER + line;
}

export function bookmarkSpot(position: number): BookmarkSpot {
    return { chapter: Math.floor(position / CHAPTER), line: position % CHAPTER };
}

/**
 * The stored position is still a line of the story: its chapter exists and
 * has at least that many lines (a replaced story text can lose some).
 */
export function bookmarkFits(position: number, chapters: { no: number; lines: number }[]): boolean {
    const { chapter, line } = bookmarkSpot(position);
    const match = chapters.find((c) => c.no === chapter);
    return !!match && line >= 1 && line <= match.lines;
}

function readAll(): Record<string, number> {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? '{}');
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function writeAll(all: Record<string, number>) {
    try {
        window.localStorage.setItem(KEY, JSON.stringify(all));
    } catch {
        // storage blocked or full: the bookmark just doesn't stick
    }
    window.dispatchEvent(new Event(CHANGE));
}

export function getBookmark(slug: string): number | null {
    const value = readAll()[slug];
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

export function setBookmark(slug: string, position: number) {
    writeAll({ ...readAll(), [slug]: position });
}

export function clearBookmark(slug: string) {
    const all = readAll();
    delete all[slug];
    writeAll(all);
}

function subscribe(onChange: () => void) {
    // CHANGE: this tab; storage: another tab
    window.addEventListener(CHANGE, onChange);
    window.addEventListener('storage', onChange);
    return () => {
        window.removeEventListener(CHANGE, onChange);
        window.removeEventListener('storage', onChange);
    };
}

/** This story's bookmark position, or null (always null on the server). */
export function useStoryBookmark(slug: string): number | null {
    return useSyncExternalStore(
        subscribe,
        () => getBookmark(slug),
        () => null
    );
}

/**
 * The rail button's click: a later line moves the bookmark there, the
 * bookmarked line clears it, an earlier line asks first.
 */
export function toggleBookmark(slug: string, chapter: number, line: number) {
    const position = bookmarkPosition(chapter, line);
    const current = getBookmark(slug);
    if (current === position) {
        clearBookmark(slug);
        return;
    }
    if (current !== null && position < current) {
        const spot = bookmarkSpot(current);
        const where = spot.chapter === chapter ? `line ${spot.line}` : `chapter ${spot.chapter}, line ${spot.line}`;
        if (!window.confirm(`This line is before your bookmark (${where}). Move the bookmark back to it?`)) return;
    }
    setBookmark(slug, position);
}
