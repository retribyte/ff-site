'use client';

import { useRouter } from 'next/navigation';
import styles from './episodeSelect.module.scss';

export interface EpisodeOption {
    value: string; // URL segment, e.g. "3-shady-business"
    label: string;
    episodeNo: number;
}

export default function EpisodeSelect({
    seasonSlug,
    options,
    currentNo,
}: {
    seasonSlug: string;
    options: EpisodeOption[];
    currentNo: number;
}) {
    const router = useRouter();
    const current = options.find((o) => o.episodeNo === currentNo);

    return (
        <select
            className={styles.select}
            value={current?.value}
            onChange={(e) => router.push(`/archives/${seasonSlug}/${e.target.value}`)}
            aria-label='Jump to episode'
        >
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.episodeNo}. {option.label}
                </option>
            ))}
        </select>
    );
}
