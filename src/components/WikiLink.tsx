import styles from './wikiLink.module.scss';

// Outbound link to the Vortox MediaWiki article, shown only when the
// record has one on file.
export default function WikiLink({ article }: { article: string | null }) {
    if (!article) return null;
    return (
        <a
            href={`https://wiki.vortox.space/wiki/${encodeURIComponent(article)}`}
            target='_blank'
            rel='noopener noreferrer'
            className={styles.wikiLink}
        >
            wiki&nbsp;↗
        </a>
    );
}
