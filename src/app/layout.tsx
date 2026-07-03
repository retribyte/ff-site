import type { Metadata } from 'next';
import { Geist, Geist_Mono, Silkscreen } from 'next/font/google';
import localFont from 'next/font/local';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import Navbar from '@/components/navbar/Navbar';
import './globals.scss';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

const silkscreen = Silkscreen({
    variable: '--font-silkscreen',
    weight: ['400', '700'],
    subsets: ['latin'],
});

const righteous = localFont({
    src: '../assets/fonts/Righteous-Regular.ttf',
    variable: '--font-righteous',
});

export const metadata: Metadata = {
    title: {
        default: 'Final Frontier',
        template: '%s · Final Frontier',
    },
    description: 'The canonical archive of the Final Frontier universe — campaigns, characters, species, and lore.',
};

// Runs before paint so the persisted theme applies without a flash.
// Uses the same localStorage key ('colorMode') as the legacy site.
const themeInitScript = `
try {
    var mode = localStorage.getItem('colorMode');
    if (mode === 'light' || mode === 'dark') {
        document.documentElement.dataset.theme = mode;
    }
} catch (e) {}
`;

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const fontVars = `${geistSans.variable} ${geistMono.variable} ${silkscreen.variable} ${righteous.variable}`;

    return (
        <html lang='en' data-theme='dark' className={fontVars} suppressHydrationWarning>
            <body>
                <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
                <ThemeProvider>
                    <Navbar />
                    {children}
                </ThemeProvider>
            </body>
        </html>
    );
}
