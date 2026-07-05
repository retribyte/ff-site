'use client';

import { scrollToMessage } from '@/components/transcript/ScanBar';
import styles from './choiceJump.module.scss';

// Every ACTION line is a choice that was made — this jumps between them.
export default function ChoiceJump({ choices }: { choices: { no: number; text: string }[] }) {
    return (
        <select
            className={styles.select}
            value=''
            onChange={(e) => {
                const no = parseInt(e.target.value);
                if (!Number.isNaN(no)) scrollToMessage(no, true);
            }}
            aria-label='Jump to a choice'
        >
            <option value='' disabled>
                jump to a choice…
            </option>
            {choices.map((choice, index) => (
                <option key={choice.no} value={choice.no}>
                    {index + 1}. {choice.text.replace(/\s*⇒\s*$/, '').slice(0, 60)}
                </option>
            ))}
        </select>
    );
}
