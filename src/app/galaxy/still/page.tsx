import { notFound } from 'next/navigation';
import StillMaker from './StillMaker';

// Dev tool: draws the picture the galaxy map falls back to without WebGL.
// Save what it shows as public/galaxy/still.webp.
export default function GalaxyStillPage() {
    if (process.env.NODE_ENV === 'production') notFound();
    return <StillMaker />;
}
