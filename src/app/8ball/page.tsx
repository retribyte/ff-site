import type { Metadata } from 'next';
import EightBall from '@/components/eightball/EightBall';

export const metadata: Metadata = {
    title: 'Magic 8-Ball',
    description: 'Ask the archive oracle a question and receive its transmission.',
};

export default function EightBallPage() {
    return <EightBall />;
}
