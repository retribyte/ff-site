import styles from './space.module.scss';

// The astrogation console's toolbar: scan-bar idiom (accent-2 left border,
// pixel-font crumb), a right-aligned mono grid-ref/status slot, and optional
// action controls.
export default function Toolbar({
    crumb,
    gridRef,
    actions,
}: {
    crumb: React.ReactNode;
    gridRef?: React.ReactNode;
    actions?: React.ReactNode;
}) {
    return (
        <div className={styles.toolbar}>
            <span className={styles.crumb}>{crumb}</span>
            <span className={styles.spacer} />
            {gridRef}
            {actions}
        </div>
    );
}
