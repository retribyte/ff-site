import { configDefaults, defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(import.meta.dirname, './src'),
        },
    },
    test: {
        // The cross-repo symlinks (ff-server, ff-site-old, space-builder-mockup)
        // would otherwise expose their tests, e.g. ff-server's node:test files.
        exclude: [...configDefaults.exclude, 'ff-server/**', 'ff-site-old/**', 'space-builder-mockup/**'],
    },
});
