'use client';

import { useSyncExternalStore } from 'react';

// Global singleton: one shared window keydown/keyup listener pair regardless
// of how many components call useShiftKey() (e.g. many DeleteControls in a list).
let shiftHeld = false;
let listenerCount = 0;
const subscribers = new Set<() => void>();

function notify() {
    subscribers.forEach((cb) => cb());
}

function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Shift' && !shiftHeld) {
        shiftHeld = true;
        notify();
    }
}

function handleKeyUp(e: KeyboardEvent) {
    if (e.key === 'Shift' && shiftHeld) {
        shiftHeld = false;
        notify();
    }
}

function handleBlur() {
    if (shiftHeld) {
        shiftHeld = false;
        notify();
    }
}

function subscribe(onStoreChange: () => void) {
    subscribers.add(onStoreChange);
    if (listenerCount === 0) {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);
    }
    listenerCount++;

    return () => {
        subscribers.delete(onStoreChange);
        listenerCount--;
        if (listenerCount === 0) {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
        }
    };
}

function getSnapshot() {
    return shiftHeld;
}

function getServerSnapshot() {
    return false;
}

export function useShiftKey() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
