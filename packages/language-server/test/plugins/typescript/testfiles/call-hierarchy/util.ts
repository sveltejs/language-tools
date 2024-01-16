export function formatDate(date: Date) {}

export function formatDate2(date: Date | string) {
    formatDate(date instanceof Date ? date: parseDate(date));
}

function parseDate(date: string): Date {
    return new Date(date);
}
