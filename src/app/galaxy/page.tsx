import type { Metadata } from 'next';
import { api } from '@/lib/api';
import SignalLost from '@/components/SignalLost';
import MapApp from '@/components/galaxy/MapApp';
import type { ApiPlace } from '@/components/galaxy/data';

export const metadata: Metadata = {
    title: 'Galaxy map',
};

export const dynamic = 'force-dynamic';

export default async function GalaxyPage() {
    let places: ApiPlace[];
    try {
        places = await api<ApiPlace[]>('/galaxy/places', { cache: 'no-store' });
    } catch {
        return (
            <main>
                <SignalLost />
            </main>
        );
    }
    return <MapApp places={places} />;
}
