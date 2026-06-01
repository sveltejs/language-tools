export function atob(encoded: string) {
    const buffer = Buffer.from(encoded, 'base64');
    return buffer.toString('utf8');
}

export function btoa(decoded: string) {
    const buffer = Buffer.from(decoded, 'utf8');
    return buffer.toString('base64');
}

export function debounce<T>(
    fn: (...args: T[]) => void,
    miliseconds: number
): (...args: T[]) => void {
    let timeout: ReturnType<typeof setTimeout>;

    return (...args: T[]) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), miliseconds);
    };
}
