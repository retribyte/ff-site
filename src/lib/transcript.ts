import { apiPaged } from './api';
import type { Message, MessageType } from './types';

// Slim shapes shared by the transcript and CYOA readers — the API includes
// full character/player objects on every message; we send id-keyed lookup
// tables to the client instead.

export interface SlimCommentary {
    id: number;
    content: string;
    creatorId: number;
    creatorName: string;
}

export interface SlimMessage {
    no: number;
    type: MessageType;
    text: string;
    characterId: number | null;
    playerId: number;
    timestamp: string | null;
    /** present only when the message has annotations */
    commentaries?: SlimCommentary[];
}

export interface SpeakerInfo {
    name: string;
    color: string | null;
    image: string | null;
}

export interface TranscriptData {
    episodeTitle: string;
    messages: SlimMessage[];
    characters: Record<number, SpeakerInfo>;
    players: Record<number, { name: string; icon: string | null }>;
}

export async function fetchAllMessages(episodeTitle: string): Promise<Message[]> {
    const encoded = encodeURIComponent(episodeTitle);
    const limit = 1000;
    const first = await apiPaged<Message>(`/episodes/${encoded}/messages?page=1&limit=${limit}`);
    const messages = [...first.data];
    const totalPages = Math.ceil(first.total / limit);
    for (let page = 2; page <= totalPages; page += 1) {
        const next = await apiPaged<Message>(`/episodes/${encoded}/messages?page=${page}&limit=${limit}`);
        messages.push(...next.data);
    }
    return messages;
}

export function slimTranscript(messages: Message[]): TranscriptData {
    const characters: TranscriptData['characters'] = {};
    const players: TranscriptData['players'] = {};

    for (const message of messages) {
        if (message.character && !(message.character.id in characters)) {
            characters[message.character.id] = {
                name: message.character.name,
                color: message.character.themeColor,
                image: message.character.image,
            };
        }
        if (message.player && !(message.player.id in players)) {
            players[message.player.id] = {
                name: message.player.username,
                icon: message.player.icon,
            };
        }
    }

    return {
        episodeTitle: messages[0]?.episodeTitle ?? '',
        characters,
        players,
        messages: messages.map((m) => ({
            no: m.messageNo,
            type: m.type,
            text: m.text,
            characterId: m.characterId,
            playerId: m.playerId,
            timestamp: m.timestamp,
            ...(m.commentaries && m.commentaries.length > 0
                ? {
                      commentaries: m.commentaries.map((c) => ({
                          id: c.id,
                          content: c.content,
                          creatorId: c.creatorId,
                          creatorName: c.creator?.username ?? 'unknown',
                      })),
                  }
                : {}),
        })),
    };
}
