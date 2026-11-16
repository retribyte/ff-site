import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import SignalLost from '@/components/SignalLost';
import MapApp from '@/components/galaxy/MapApp';
import { readAddress } from '@/components/galaxy/data';
import type { ApiPlace } from '@/components/galaxy/data';

// /galaxy is the map; /galaxy?at=<place> has that place picked; /galaxy/<system> is
// that system's own view and /galaxy/<system>/<body> has one of its bodies picked.
// The map itself changes the address as it is used (see `addressUrl` in data.ts).
interface Props {
    params: Promise<{ path?: string[] }>;
    searchParams: Promise<{ at?: string | string[] }>;
}

export const dynamic = 'force-dynamic';

const getPlaces = cache(() => api<ApiPlace[]>('/galaxy/places', { cache: 'no-store' }));

async function resolve({ params, searchParams }: Props) {
    const [{ path = [] }, { at }, places] = await Promise.all([params, searchParams, getPlaces()]);
    return { places, address: readAddress(path, typeof at === 'string' ? at : null, places) };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
    try {
        const { places, address } = await resolve(props);
        const place = places.find((p) => p.id === address?.placeId);
        const body = place?.bodies.find((b) => b.id === address?.bodyId);
        const name = body?.name ?? place?.name;
        return { title: name ? `${name}, galaxy map` : 'Galaxy map' };
    } catch {
        return { title: 'Galaxy map' };
    }
}

export default async function GalaxyPage(props: Props) {
    let found: Awaited<ReturnType<typeof resolve>>;
    try {
        found = await resolve(props);
    } catch {
        return (
            <main>
                <SignalLost />
            </main>
        );
    }
    // An address that names nothing on the map
    if (!found.address) notFound();
    return <MapApp places={found.places} start={found.address} />;
}
