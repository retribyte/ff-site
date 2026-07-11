// Telemetry-sheet number formatting: space-grouped thousands, matching the
// design mockup's "4 982 km" style rather than comma-grouped.
export function formatNumber(n: number, maxFractionDigits = 0): string {
    return n.toLocaleString('en-US', { maximumFractionDigits: maxFractionDigits }).replace(/,/g, ' ');
}

export function formatKm(n: number): string {
    return `${formatNumber(n)} km`;
}

export function formatAu(n: number): string {
    return `${n.toFixed(2)} AU`;
}
