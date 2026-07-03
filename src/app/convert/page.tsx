import type { Metadata } from 'next';
import Converter from '@/components/convert/Converter';

export const metadata: Metadata = {
    title: 'Chrono Conversion',
    description: 'Convert between Galactic Union time and Earth standard time.',
};

export default function ConvertPage() {
    return <Converter />;
}
