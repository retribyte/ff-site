import { describe, expect, it } from 'vitest';
import { parseDescribe } from './version';

describe('parseDescribe', () => {
    it('adds the commits since the tag to the patch', () => {
        expect(parseDescribe('v1.1.0-0-g3fa9c2e')).toEqual({ version: '1.1.0', commit: '3fa9c2e' });
        expect(parseDescribe('v1.1.0-14-g3fa9c2e\n')).toEqual({ version: '1.1.14', commit: '3fa9c2e' });
        expect(parseDescribe('v1.0.1-3-gabcdef0')).toEqual({ version: '1.0.4', commit: 'abcdef0' });
    });

    it('a minor or major tag zeroes what comes after it', () => {
        expect(parseDescribe('v1.2.0-0-g1234567')?.version).toBe('1.2.0');
        expect(parseDescribe('v2.0.0-5-g1234567')?.version).toBe('2.0.5');
    });

    it('marks a dirty working tree', () => {
        expect(parseDescribe('v1.1.0-14-g3fa9c2e-dirty')?.version).toBe('1.1.14-dirty');
    });

    it('rejects anything else', () => {
        expect(parseDescribe('legacy-v1-4-g3fa9c2e')).toBeNull();
        expect(parseDescribe('3fa9c2e')).toBeNull();
        expect(parseDescribe('')).toBeNull();
    });
});
