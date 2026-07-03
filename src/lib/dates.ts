// Site-wide date convention for lore records: dd-mm-yyyy.

export function formatDdMmYyyy(date: Date): string {
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${dd}-${mm}-${date.getUTCFullYear()}`;
}

/** Parses dd-mm-yyyy into ISO yyyy-mm-dd (what the API's Date() parse needs); null if malformed. */
export function ddMmYyyyToIso(value: string): string | null {
    const match = value.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (!match) return null;
    const [, dd, mm, yyyy] = match;
    const day = parseInt(dd);
    const month = parseInt(mm);
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    return `${yyyy}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
