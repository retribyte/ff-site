import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import type { Item } from '@/lib/types';
import { ITEM_TYPE_META } from '@/lib/lore';
import SignalLost from '@/components/SignalLost';
import WikiLink from '@/components/WikiLink';
import styles from './itemDetail.module.scss';

interface Props {
    params: Promise<{ id: string }>;
}

async function getItem(id: number): Promise<Item | null> {
    try {
        return await api<Item>(`/items/${id}`);
    } catch (error) {
        if (error instanceof ApiError && error.httpStatus === 404) return null;
        throw error;
    }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    try {
        const item = await getItem(parseInt(id));
        return { title: item ? item.name : 'Items' };
    } catch {
        return { title: 'Items' };
    }
}

export default async function ItemPage({ params }: Props) {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (Number.isNaN(id)) notFound();

    let item: Item | null;
    try {
        item = await getItem(id);
    } catch {
        return (
            <main className={styles.main}>
                <SignalLost />
            </main>
        );
    }
    if (!item) notFound();

    const meta = ITEM_TYPE_META[item.itemType];

    return (
        <main className={styles.main} style={{ '--type': meta.color } as React.CSSProperties}>
            <nav className={styles.breadcrumb}>
                <Link href='/items'>← recovered effects</Link>
            </nav>

            <div className={styles.layout}>
                <article className={styles.article}>
                    <div className={styles.nameRow}>
                        <h1 className={styles.name}>{item.name}</h1>
                        <WikiLink article={item.wikiArticle} />
                    </div>
                    <p className={styles.typeLine}>
                        <span className={styles.typeChip}>
                            {meta.glyph} {meta.label}
                        </span>
                    </p>

                    <p className={styles.description}>{item.description}</p>

                    {item.character && (
                        <p className={styles.bearer}>
                            <span className='pixel-label'>held by </span>
                            <Link href={`/characters/${item.character.id}`}>{item.character.name}</Link>
                        </p>
                    )}
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
                        <div className={styles.fact}>
                            <dt>type</dt>
                            <dd>{meta.label}</dd>
                        </div>
                        {item.character && (
                            <div className={styles.fact}>
                                <dt>bearer</dt>
                                <dd>
                                    <Link href={`/characters/${item.character.id}`} className={styles.factLink}>
                                        {item.character.name}
                                    </Link>
                                </dd>
                            </div>
                        )}
                        {item.creator && (
                            <div className={styles.fact}>
                                <dt>recorded by</dt>
                                <dd>{item.creator.username}</dd>
                            </div>
                        )}
                    </dl>
                </aside>
            </div>
        </main>
    );
}
