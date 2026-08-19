import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import type { Species } from '@/lib/types';
import { SENTIENCE_LABELS } from '@/lib/lore';
import { getSessionUser } from '@/lib/auth';
import SignalLost from '@/components/SignalLost';
import ActionChip from '@/components/editor/ActionChip';
import CharacterCard from '@/components/characters/CharacterCard';
import WikiLink from '@/components/WikiLink';
import { renderWikiText } from '@/lib/wiki';
import styles from './speciesDetail.module.scss';

interface Props {
    params: Promise<{ id: string }>;
}

async function getSpecies(param: string): Promise<Species | null> {
    try {
        return await api<Species>(`/species/${param}`);
    } catch (error) {
        if (error instanceof ApiError && error.httpStatus === 404) return null;
        throw error;
    }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    try {
        const species = await getSpecies(id);
        return { title: species ? species.name : 'Species' };
    } catch {
        return { title: 'Species' };
    }
}

export default async function SpeciesPage({ params }: Props) {
    const { id: idParam } = await params;

    let species: Species | null;
    try {
        species = await getSpecies(idParam);
    } catch {
        return (
            <main className={styles.main}>
                <SignalLost />
            </main>
        );
    }
    if (!species) notFound();

    const user = await getSessionUser();
    const canEdit = user !== null && (user.role === 'ADMIN' || user.id === species.creatorId);

    const members = [...(species.Character ?? [])].sort((a, b) => {
        const rank = (c: { image: string | null; color: string | null }) => (c.image ? 0 : c.color ? 1 : 2);
        return rank(a) - rank(b) || a.name.localeCompare(b.name);
    });

    const facts: [string, React.ReactNode][] = [['sentience', SENTIENCE_LABELS[species.class]]];

    const wiki = species.wiki;
    if (wiki?.union_name) facts.push(['binomial name', renderWikiText(wiki.union_name)]);
    if (wiki?.homeworld) facts.push(['homeworld', renderWikiText(wiki.homeworld)]);
    if (wiki?.habitat) facts.push(['habitat', renderWikiText(wiki.habitat)]);
    if (wiki?.lifespan) facts.push(['lifespan', renderWikiText(wiki.lifespan)]);
    if (wiki?.diet) facts.push(['diet', renderWikiText(wiki.diet)]);
    if (wiki?.procreation_method) facts.push(['procreation', renderWikiText(wiki.procreation_method)]);
    if (wiki?.faction) facts.push(['faction', renderWikiText(wiki.faction)]);
    if (wiki?.religion) facts.push(['religion', renderWikiText(wiki.religion)]);
    if (wiki?.government) facts.push(['government', renderWikiText(wiki.government)]);
    if (wiki?.technology_progression) facts.push(['technology', renderWikiText(wiki.technology_progression)]);

    return (
        <main className={styles.main}>
            <nav className={styles.breadcrumb}>
                <Link href='/species'>← xenobiology index</Link>
            </nav>

            <div className={styles.layout}>
                <article className={styles.article}>
                    <div className={styles.nameRow}>
                        <h1 className={styles.name}>{species.name}</h1>
                        <WikiLink slug={species.slug} />
                        {canEdit && <ActionChip href={`/species/${species.slug}/edit`} label='edit ✎' />}
                    </div>

                    <p className={styles.description}>{species.description}</p>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>
                            Known members <span className='pixel-label'>({members.length})</span>
                        </h2>
                        {members.length === 0 ? (
                            <p className='pixel-label'>no recorded members of this taxon</p>
                        ) : (
                            <ul className={styles.memberGrid}>
                                {members.map((member) => (
                                    <li key={member.id}>
                                        <CharacterCard
                                            character={{
                                                id: member.id,
                                                name: member.name,
                                                color: member.color,
                                                image: member.image,
                                                slug: member.slug,
                                            }}
                                        />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </article>

                <aside className={`pixel-panel ${styles.infobox}`}>
                    <div className={styles.infoboxHeader}>
                        <span className={styles.infoboxGlyph} aria-hidden>
                            ⌬
                        </span>
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
