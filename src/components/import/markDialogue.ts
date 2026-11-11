import type { AssignedVoice } from "./NpcVoiceNamer";

// Marking text in the import preview as dialogue (or back to narration): a
// narration paragraph's inline runs are re-cut so the selected characters
// become one run with the chosen voice. Pure, so the importer can apply it to
// its payload. Segment texts still concatenate to the line's text.

export interface MarkSegment {
  text: string;
  speaker?: string;
  npc?: boolean;
  voice?: AssignedVoice;
  italic?: boolean;
  bold?: boolean;
}

/**
 * Who the marked text is spoken by, as the payload stores it: a doc speaker
 * by name (mapped on the speakers list), an NPC quote (`npc`, named in the NPC
 * namer, or given to a character with `voice`), or null for narration.
 */
export type MarkVoice =
  { speaker: string } | { npc: true; voice?: AssignedVoice } | null;

const sameRun = (a: MarkSegment, b: MarkSegment) =>
  a.speaker === b.speaker &&
  !!a.npc === !!b.npc &&
  a.voice?.characterId === b.voice?.characterId &&
  a.voice?.personaId === b.voice?.personaId &&
  !!a.italic === !!b.italic &&
  !!a.bold === !!b.bold;

/**
 * The line's segments with characters [start, end) of its text given `voice`.
 * Returns undefined when nothing is left to segment (plain narration).
 */
export function markRange(
  line: { text: string; segments?: MarkSegment[] },
  start: number,
  end: number,
  voice: MarkVoice,
): MarkSegment[] | undefined {
  const source = line.segments?.length ? line.segments : [{ text: line.text }];
  const cut: MarkSegment[] = [];
  let pos = 0;
  for (const seg of source) {
    const from = pos;
    const to = pos + seg.text.length;
    pos = to;
    const edges = [
      from,
      Math.min(to, Math.max(from, start)),
      Math.min(to, Math.max(from, end)),
      to,
    ];
    for (let i = 0; i < 3; i++) {
      if (edges[i + 1] <= edges[i]) continue;
      const piece: MarkSegment = {
        ...seg,
        text: seg.text.slice(edges[i] - from, edges[i + 1] - from),
      };
      if (i === 1) {
        delete piece.speaker;
        delete piece.npc;
        delete piece.voice;
        if (voice) Object.assign(piece, voice);
      }
      cut.push(piece);
    }
  }
  const merged: MarkSegment[] = [];
  for (const seg of cut) {
    const prev = merged.at(-1);
    if (prev && sameRun(prev, seg)) prev.text += seg.text;
    else merged.push(seg);
  }
  const plain = merged.every(
    (s) => !s.speaker && !s.npc && !s.voice && !s.italic && !s.bold,
  );
  return plain ? undefined : merged;
}
