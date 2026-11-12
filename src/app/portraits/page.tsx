import type { Metadata } from 'next';
import PortraitCreator from '@/components/portrait/PortraitCreator';

export const metadata: Metadata = {
    title: 'Portrait Creator',
    description: 'Build a character portrait from Starbound sprites: race, colours, wardrobe and pose.',
};

export default function PortraitsPage() {
    return <PortraitCreator />;
}
