import { lt, coerce, gte } from 'semver';

/**
 * @example
 * const supported = atLeast({
 *     packageName: 'node',
 *     versionMin: '18.3',
 *     versionToCheck: process.versions.node
 *     fallback: true // optional
 * });
 */
export function atLeast(o: {
    packageName: string;
    versionMin: string;
    versionToCheck: string;
    fallback: boolean;
}): boolean;
export function atLeast(o: {
    packageName: string;
    versionMin: string;
    versionToCheck: string;
    fallback?: undefined;
}): boolean | undefined;

// Implementation
export function atLeast(o: {
    packageName: string;
    versionMin: string;
    versionToCheck: string;
    fallback?: boolean;
}): boolean | undefined {
    const { packageName, versionMin, versionToCheck, fallback } = o;
    if (versionToCheck === undefined || versionToCheck === '') return fallback;

    if (
        versionToCheck.includes('latest') ||
        versionToCheck.includes('catalog:') ||
        versionToCheck.includes('http')
    ) {
        console.warn(`Version '${versionToCheck}' for '${packageName}' is not supported`);
        return fallback;
    }
    try {
        const vMin = coerce(versionMin);
        const vToCheck = coerce(versionToCheck);
        if (vMin && vToCheck) {
            return gte(vToCheck, vMin);
        }
    } catch (error) {}
    return fallback;
}
