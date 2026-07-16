import styles from './wikiLink.module.scss';

// Outbound link to the Vortox MediaWiki article, derived from the record's slug.
export default function WikiLink({ slug }: { slug: string }) {
    return (
        <a
            href={`https://wiki.vortox.space/wiki/${encodeURIComponent(slug)}`}
            target='_blank'
            rel='noopener noreferrer'
            className={styles.wikiLink}
        >
            wiki&nbsp;↗
        </a>
    );
}
