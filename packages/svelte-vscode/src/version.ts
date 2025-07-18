type Version = {
    major?: number;
    minor?: number;
    patch?: number;
};

export function versionSplit(str: string): Version {
    const [major, minor, patch] = str?.split('.') ?? [];

    function toVersionNumber(val: string | undefined): number | undefined {
        return val !== undefined && val !== '' && !isNaN(Number(val)) ? Number(val) : undefined;
    }

    return {
        major: toVersionNumber(major),
        minor: toVersionNumber(minor),
        patch: toVersionNumber(patch)
    };
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
export function minimumRequirement(version: string): {
    for: (target: string) => boolean | undefined;
} {
    return {
        for: (target: string) => versionUnsupportedBelow(target, version)
    };
}
