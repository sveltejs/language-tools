export function clamp(num: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, num));
}
