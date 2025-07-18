import { minVersion, valid, gt, gte, lt, lte, coerce } from 'semver';

type Version = {
    isValid: boolean;

    major?: number;
    minor?: number;
    patch?: number;
    beta?: string;

    info?: 'equal' | 'gte' | 'gt' | 'is-patch-beta';
    specifier?: 'major' | 'minor' | 'patch';
};

export function versionSplit(str: string): Version {
    let isValid = true;
    let beta: string | undefined = undefined;
    let [majorStr, minorStr, ...rest] = str?.split('.') ?? [];
    let patchStr = rest.join('.');

    let info: Version['info'] = undefined;
    // major can have a special prefix
    if (majorStr?.startsWith('>=')) {
        majorStr = majorStr.slice(2);
        info = 'gte';
    } else if (majorStr?.startsWith('>')) {
        majorStr = majorStr.slice(1);
        info = 'gt';
    } else {
        info = 'equal';
    }

    // patch could be like: 0.22.6-exp.2 or 3.0.6-next.1
    if (patchStr?.includes('-')) {
        const [p1, ...rest2] = patchStr.split('-');
        beta = rest2.join('-');
        patchStr = p1;
        info = 'is-patch-beta';
    }

    function toVersionNumber(val: string | undefined): number | undefined {
        return val !== undefined && val !== '' && !isNaN(Number(val)) ? Number(val) : undefined;
    }

    const major = toVersionNumber(majorStr);
    const minor = toVersionNumber(minorStr);
    const patch = toVersionNumber(patchStr);

    let specifier: Version['specifier'] = undefined;
    if (patch !== undefined) {
        specifier = 'patch';
    } else if (minor !== undefined) {
        specifier = 'minor';
    } else if (major !== undefined) {
        specifier = 'major';
    }

    if (major === undefined && minor === undefined && patch === undefined) {
        isValid = false;
    } else if (patch !== undefined && (minor === undefined || major === undefined)) {
        isValid = false;
    } else if (minor !== undefined && major === undefined) {
        isValid = false;
    }

    return { major, minor, patch, beta, info, specifier, isValid };
}

function versionUnsupportedBelow(version_str: string, below_str: string): boolean | undefined {
    const version = versionSplit(version_str);
    const below = versionSplit(below_str);

    if (version.major === undefined || below.major === undefined) return undefined;
    if (version.major < below.major) return true;
    if (version.major > below.major) return false;

    if (version.minor === undefined || below.minor === undefined) {
        if (version.major === below.major) return false;
        else return true;
    }
    if (version.minor < below.minor) return true;
    if (version.minor > below.minor) return false;

    if (version.patch === undefined || below.patch === undefined) {
        if (version.minor === below.minor) return false;
        else return true;
    }
    if (version.patch < below.patch) return true;
    if (version.patch > below.patch) return false;
    if (version.patch === below.patch) return false;

    return undefined;
}

/**
 * @example
 * const unsupported = minimumRequirement('18.3').for(process.versions.node);
 */
export function minimumRequirement(versionMin: string): {
    for: (versionToCheck: string) => boolean | undefined;
} {
    return {
        for: (versionToCheck: string) => {
            if (versionToCheck === undefined) return undefined;
            if (versionToCheck === '') return undefined;
            try {
                const vMin = coerce(versionMin);
                const vToCheck = coerce(minVersion(versionToCheck));
                if (vMin && vToCheck) {
                    return lt(vToCheck, vMin);
                }
            } catch (error) {}
            return undefined;

            return versionUnsupportedBelow(versionToCheck, versionMin);
        }
    };
}
