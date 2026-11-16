// PROTOTYPE, throwaway. Galaxy map layout variants; never ships (404 in production).
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Prototype from './Prototype';

export const metadata = { title: 'Galaxy map prototype' };

export default function Page() {
    if (process.env.NODE_ENV === 'production') notFound();
    return (
        <Suspense>
            <Prototype />
        </Suspense>
    );
}
