// Story.publishedDate and similar calendar dates arrive from the API as
// midnight UTC ("2026-11-03T00:00:00.000Z"). They are a day, not a moment:
// formatting one in the viewer's local time shows the previous evening's date
// across the Americas (Nov 2). Always go through these helpers.

/** "YYYY-MM-DD" from an API date, or null if it isn't one (also for null/undefined). */
export function dateOnly(value: string | null | undefined): string | null {
    const match = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
    return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

/** "Nov 3, 2026" for an API date, read as that calendar day whatever the viewer's timezone. Null if it isn't a date. */
export function formatDateOnly(value: string | null | undefined): string | null {
    const day = dateOnly(value);
    if (!day) return null;
    const [year, month, date] = day.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, date)).toLocaleDateString('en-US', {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}
