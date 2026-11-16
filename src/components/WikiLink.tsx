import styles from './wikiLink.module.scss';

// Outbound link to the Vortox MediaWiki article, derived from the record's slug.
// `page` (the article's own title, when known) wins over the slug.
export default function WikiLink({ slug, page }: { slug: string; page?: string }) {
    return (
        <a
            href={`https://wiki.vortox.space/wiki/${encodeURIComponent(page ? page.replace(/ /g, '_') : slug)}`}
            target='_blank'
            rel='noopener noreferrer'
            className={styles.wikiLink}
        >
            View wiki article&nbsp;↗
        </a>
    );
}
