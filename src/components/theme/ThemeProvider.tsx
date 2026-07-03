'use client';

import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';

export type ColorMode = 'light' | 'dark';

// The <html data-theme> attribute is the source of truth — the pre-paint
// script in layout.tsx stamps it before React ever runs. We mirror it into
// React state via useSyncExternalStore so hydration stays clean.
function subscribe(onChange: () => void) {
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
}

function getSnapshot(): ColorMode {
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function getServerSnapshot(): ColorMode {
    return 'dark';
}

const ThemeContext = createContext<{ colorMode: ColorMode; toggleColorMode: () => void }>({
    colorMode: 'dark',
    toggleColorMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const colorMode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    const toggleColorMode = useCallback(() => {
        const next = getSnapshot() === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        try {
            localStorage.setItem('colorMode', next);
        } catch {
            // private browsing etc. — theme just won't persist
        }
    }, []);

    return <ThemeContext.Provider value={{ colorMode, toggleColorMode }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    return useContext(ThemeContext);
}
