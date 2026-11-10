import { describe, expect, it } from 'vitest';
import { arkabilarName, parseArkabilar, parseEarthString, parseGuyString } from './guy-format';

describe('Arkabilar', () => {
    it('names semesters per the wiki examples', () => {
        expect(arkabilarName(1)).toBe('Arka-Unnos');
        expect(arkabilarName(18)).toBe('Dalne-Bilar');
        expect(arkabilarName(27)).toBe('Gorjo-Terkan');
        expect(arkabilarName(32)).toBe('Gorjo-Okteg');
        expect(arkabilarName(0)).toBeNull();
        expect(arkabilarName(33)).toBeNull();
    });
    it('round-trips all 32', () => {
        for (let n = 1; n <= 32; n++) expect(parseArkabilar(arkabilarName(n)!)).toBe(n);
        expect(parseArkabilar('dalne bilar')).toBe(18);
        expect(parseArkabilar('nope')).toBeNull();
    });
});

describe('parseGuyString', () => {
    it('parses the converter output', () => {
        expect(parseGuyString('Turkal, 4 of 2, 3022 GUY ⁄ 10:54:28.09')).toEqual({
            year: 3022, semester: 2, equinox: 4, period: 10, union: 54, duon: 28, trion: 9,
        });
    });
    it('handles negative years, dashed form, Arkabilar, no time', () => {
        expect(parseGuyString('1 of 1, -142 GUY')?.year).toBe(-142);
        expect(parseGuyString('4-2-3022 GUY')?.semester).toBe(2);
        expect(parseGuyString('Rinns, 9 of Dalne-Bilar, 3024 GUY')?.semester).toBe(18);
    });
    it('rejects out-of-range', () => {
        expect(parseGuyString('46 of 2, 3022')).toBeNull();
        expect(parseGuyString('4 of 33, 3022')).toBeNull();
    });
});

describe('parseEarthString', () => {
    it('parses the converter output', () => {
        expect(parseEarthString('13 Mar 1853 BCE, 10:54:28.150 UTC')).toEqual({
            era: 'BCE', year: 1853, month: 3, day: 13, hour: 10, minute: 54, second: 28, ms: 150,
        });
        expect(parseEarthString('9 Jun 10062 CE, 00:00:00.000 UTC')?.year).toBe(10062);
    });
    it('accepts ISO and full month names', () => {
        expect(parseEarthString('2018-06-21T04:05:06.007Z')).toMatchObject({ month: 6, day: 21, hour: 4, ms: 7 });
        expect(parseEarthString('21 June 2018')).toMatchObject({ month: 6, era: 'CE' });
    });
    it('rejects junk', () => {
        expect(parseEarthString('hello')).toBeNull();
    });
});
