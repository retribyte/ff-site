import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import type { Item } from '@/lib/types';
import { ITEM_TYPE_META } from '@/lib/lore';
import { getSessionUser } from '@/lib/auth';
import SignalLost from '@/components/SignalLost';
import ActionChip from '@/components/editor/ActionChip';
import WikiLink from '@/components/WikiLink';
import { renderWikiText } from '@/lib/wiki';
import styles from './itemDetail.module.scss';

interface Props {
    params: Promise<{ id: string }>;
}

async function getItem(param: string): Promise<Item | null> {
    try {
        return await api<Item>(`/items/${param}`);
    } catch (error) {
        if (error instanceof ApiError && error.httpStatus === 404) return null;
        throw error;
    }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    try {
        const item = await getItem(id);
        return { title: item ? item.name : 'Items' };
    } catch {
        return { title: 'Items' };
    }
}

export default async function ItemPage({ params }: Props) {
    const { id: idParam } = await params;

    let item: Item | null;
    try {
        item = await getItem(idParam);
    } catch {
        return (
            <main className={styles.main}>
                <SignalLost />
            </main>
        );
    }
    if (!item) notFound();

    const user = await getSessionUser();
    const canEdit = user !== null && (user.role === 'ADMIN' || user.id === item.creatorId);

    const meta = ITEM_TYPE_META[item.itemType];

    const facts: [string, React.ReactNode][] = [['type', meta.label]];
    if (item.creator) facts.push(['recorded by', item.creator.username]);

    const wiki = item.wiki;
    if (wiki?.rarity) facts.push(['rarity', renderWikiText(wiki.rarity)]);
    if (wiki?.use) facts.push(['use', renderWikiText(wiki.use)]);
    if (wiki?.damage) facts.push(['damage', renderWikiText(wiki.damage)]);
    if (wiki?.armor) facts.push(['armor', renderWikiText(wiki.armor)]);
    if (wiki?.value) facts.push(['value', renderWikiText(wiki.value)]);
    if (wiki?.market_value_free) facts.push(['market value', renderWikiText(wiki.market_value_free)]);
    if (wiki?.faction) facts.push(['faction', renderWikiText(wiki.faction)]);
    if (wiki?.character) facts.push(['used by', renderWikiText(wiki.character)]);
    if (wiki?.age) facts.push(['age', renderWikiText(wiki.age)]);
    if (wiki?.location) facts.push(['location', renderWikiText(wiki.location)]);

    return (
        <main className={styles.main} style={{ '--type': meta.color } as React.CSSProperties}>
            <nav className={styles.breadcrumb}>
                <Link href='/items'>← recovered effects</Link>
            </nav>

            <div className={styles.layout}>
                <article className={styles.article}>
                    <div className={styles.nameRow}>
                        <h1 className={styles.name}>{item.name}</h1>
                        <WikiLink slug={item.slug} />
                        {canEdit && <ActionChip href={`/items/${item.slug}/edit`} label='edit ✎' />}
                    </div>
                    <p className={styles.typeLine}>
                        <span className={styles.typeChip}>
                            {meta.glyph} {meta.label}
                        </span>
                    </p>

                    <p className={styles.description}>{item.description}</p>
                </article>

                <aside className={`pixel-panel ${styles.infobox}`}>
                    <div className={styles.infoboxHeader}>
                        {item.image ? (
                            <Image src={item.image} alt={item.name} width={96} height={96} unoptimized />
                        ) : (
                            <span className={styles.infoboxGlyph} aria-hidden>
                                {meta.glyph}
                            </span>
                        )}
                    </div>
                    <dl className={styles.facts}>
                        {facts.map(([label, value]) => (
                            <div key={label} className={styles.fact}>
                                <dt>{label}</dt>
                                <dd>{value}</dd>
                            </div>
                        ))}
                    </dl>
                </aside>
            </div>
        </main>
    );
}
