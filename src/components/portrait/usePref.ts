'use client';

import { useCallback, useSyncExternalStore } from 'react';

// A small choice remembered in this browser (list or grid, how swatches are sorted) and shared
// by every component that reads it, so changing it in one place updates the others.

const listeners = new Set<() => void>();
const subscribe = (onChange: () => void) => {
    listeners.add(onChange);
    return () => listeners.delete(onChange);
};

function read(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null; // storage blocked: the choice just lasts for the visit
    }
}

const memory = new Map<string, string>();

export function usePref<T extends string>(key: string, allowed: readonly T[], fallback: T): [T, (value: T) => void] {
    const stored = useSyncExternalStore(subscribe, () => memory.get(key) ?? read(key), () => null);
    const value = allowed.includes(stored as T) ? (stored as T) : fallback;
    const set = useCallback((next: T) => {
        memory.set(key, next);
        try {
            localStorage.setItem(key, next);
        } catch {
            // kept in memory only
        }
        listeners.forEach((l) => l());
    }, [key]);
    return [value, set];
}
