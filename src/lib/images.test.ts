import { describe, expect, it } from 'vitest';
import { imageSrc } from './images';
import { BOORU_URL } from './booru';

describe('imageSrc', () => {
    it('routes uploaded avatars through the same-origin ff-server proxy', () => {
        expect(imageSrc('/api/avatars/abc.png')).toBe('/site/ff/avatars/abc.png');
    });

    it('routes booru images through their proxy', () => {
        expect(imageSrc(`${BOORU_URL}/_images/x.png`)).toMatch(/^\/site\/ff\/booru\/image\?url=/);
    });

    it('leaves local paths and data URLs alone', () => {
        expect(imageSrc('/avatars/emmett.png')).toBe('/avatars/emmett.png');
        expect(imageSrc('data:image/png;base64,AA==')).toBe('data:image/png;base64,AA==');
    });

    it('passes empty values through as null', () => {
        expect(imageSrc(null)).toBeNull();
    });
});
