import { describe, expect, it } from 'vitest';
import { alignLines, applyRevision, compareStory, wordDiff, type RevChapter, type RevLine } from './storyRevision';

const narr = (text: string): RevLine => ({ type: 'NARRATION', text });
const said = (text: string, characterId: number): RevLine => ({ type: 'DIALOGUE', text, characterId });
const chapter = (lines: RevLine[], chapter_no = 1): RevChapter<RevLine> => ({ chapter_no, lines });
const texts = (chapters: RevChapter<RevLine>[]) => chapters.flatMap((c) => c.lines.map((l) => l.text));

describe('compareStory', () => {
    it('finds nothing when the draft matches the shelf', () => {
        const lines = [narr('A.'), said('Hi.', 1)];
        expect(compareStory([chapter(lines)], [chapter(lines.map((l) => ({ ...l })))]).changes).toEqual([]);
    });

    it('lists a changed, an added and a removed line in reading order', () => {
        const shelf = [chapter([narr('The hatch opens.'), narr('Legacy only.'), narr('Dust everywhere and more.')])];
        const draft = [chapter([narr('The hatch opens.'), narr('Dust everywhere, and more!'), narr('A new line.')])];
        const { changes } = compareStory(shelf, draft);
        expect(changes.map((c) => [c.kind, c.shelf?.text ?? null, c.incoming?.text ?? null])).toEqual([
            ['removed', 'Legacy only.', null],
            ['changed', 'Dust everywhere and more.', 'Dust everywhere, and more!'],
            ['added', null, 'A new line.'],
        ]);
    });

    it('treats unalike leftovers as a removal plus an addition, not an edit', () => {
        const { changes } = compareStory([chapter([narr('Same.'), narr('Old wording entirely.')])], [chapter([narr('Same.'), narr('Brand new text here.')])]);
        expect(changes.map((c) => c.kind)).toEqual(['removed', 'added']);
    });

    it('notices a voice or type change on the same text', () => {
        const { changes } = compareStory(
            [chapter([said('Hi.', 1), { type: 'TRANSCRIPT', text: 'VCOMM' }])],
            [chapter([said('Hi.', 2), narr('VCOMM')])]
        );
        expect(changes.map((c) => c.differs)).toEqual([['voice'], ['type']]);
    });

    it('counts an NPC by name the same either way it is written', () => {
        const shelf = [chapter([{ type: 'DIALOGUE', text: 'Halt!', npcVoice: true, speaker: 'Guard' }])];
        const draft = [chapter([{ type: 'DIALOGUE', text: 'Halt!', speaker: 'guard' }])];
        expect(compareStory(shelf, draft).changes).toEqual([]);
    });
});

describe('applyRevision', () => {
    const shelf = [chapter([narr('Keep me.'), narr('Typo fixed on site.'), narr('Same.')])];
    const draft = [chapter([narr('Typo fxied on site.'), narr('Same.'), narr('New on Discord.')])];
    const revision = compareStory(shelf, draft);
    const key = (kind: string) => revision.changes.find((c) => c.kind === kind)!.key;

    it("takes the draft's side by default", () => {
        expect(texts(applyRevision(revision, new Set()))).toEqual(['Typo fxied on site.', 'Same.', 'New on Discord.']);
    });

    it("keeps the shelf's side where picked", () => {
        const keep = new Set([key('removed'), key('changed'), key('added')]);
        expect(texts(applyRevision(revision, keep))).toEqual(['Keep me.', 'Typo fixed on site.', 'Same.']);
    });

    it('drops a chapter left with no lines', () => {
        const rev = compareStory([chapter([narr('Old.')], 2)], [chapter([narr('Only.')], 1)]);
        expect(applyRevision(rev, new Set()).map((c) => c.chapter_no)).toEqual([1]);
    });
});

describe('alignLines', () => {
    it('ignores whitespace differences when matching', () => {
        expect(alignLines(['a  b', 'c'], ['a b', 'c'])).toEqual([0, 1]);
    });
});

describe('wordDiff', () => {
    it('marks the words that changed', () => {
        expect(wordDiff("the FLARE you'd lit inside", "the FLARE you'd light inside")).toEqual([
            { text: "the FLARE you'd ", op: 'same' },
            { text: 'lit', op: 'del' },
            { text: 'light', op: 'ins' },
            { text: ' inside', op: 'same' },
        ]);
    });
});
