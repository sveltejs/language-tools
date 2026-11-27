// No `vscode` import: unit tested with vitest

/**
 * The `contentMappers` entry users add to their tsconfig (`extensions` come from the mapper's
 * package manifest). The one place it is defined; the hints below and the "copy" action use it.
 */
export const RECOMMENDED_CONTENT_MAPPER_REGISTRATION = {
    package: '@sveltejs/ts-content-mapper'
} as const;

export const CONTENT_MAPPER_PACKAGE = RECOMMENDED_CONTENT_MAPPER_REGISTRATION.package;

/** What to add to the tsconfig, as a property of its top-level object */
export function getContentMapperConfigSnippet(): string {
    const entry = Object.entries(RECOMMENDED_CONTENT_MAPPER_REGISTRATION)
        .map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`)
        .join(', ');
    return `"contentMappers": [{ ${entry} }]`;
}

/**
 * Whether a TypeScript server of this version supports content mappers (7.1 or newer).
 * Undefined if the version can't be parsed.
 */
export function supportsContentMappers(version: string | undefined): boolean | undefined {
    const match = /^(\d+)\.(\d+)/.exec(version ?? '');
    if (!match) {
        return undefined;
    }
    const major = Number(match[1]);
    const minor = Number(match[2]);
    return major > 7 || (major === 7 && minor >= 1);
}

/** Mirrors `ContentMapperConfigCheck` of the language server (`plugins/typescript-go/content-mapper.ts`) */
export interface ContentMapperConfigStatus {
    configFile?: string;
}

const fallbackNote =
    'Svelte files use the TypeScript features built into the Svelte extension (TypeScript 6) instead.';

/**
 * The missing-config hint for a language server that was asked for content mapper mode and reported
 * this config status. Undefined if a config registers the mapper.
 */
export function getContentMapperConfigHint(
    status: ContentMapperConfigStatus | undefined
): string | undefined {
    if (!status || status.configFile) {
        return undefined;
    }

    return (
        'TypeScript 7 is enabled, but no tsconfig/jsconfig in the workspace registers the Svelte content mapper, ' +
        'which TypeScript 7 needs to understand Svelte files. To use it, install ' +
        `\`${CONTENT_MAPPER_PACKAGE}\` as a dev dependency and add ${getContentMapperConfigSnippet()} ` +
        'to the tsconfig*.json or jsconfig*.json of the workspace that includes your Svelte files. ' +
        'It is not found when it is only inherited through "extends" from a file with another name or from a package. ' +
        '(Content mappers need TypeScript 7.1 or higher.) ' +
        fallbackNote
    );
}

/** The warning for a TypeScript 7 server that can't serve Svelte files */
export function getUnsupportedTsServerMessage(version: string): string {
    return (
        `The TypeScript 7 language server is version ${version}. TypeScript needs content mappers to understand ` +
        'Svelte files, and those require TypeScript 7.1 or higher. ' +
        fallbackNote +
        ' To use TypeScript 7 for Svelte files, select a TypeScript 7.1 installation ' +
        '(e.g. install `typescript@^7.1` in the project and set "js/ts.tsdk.path").'
    );
}

export function getUnsupportedTsExtensionMessage(extensionVersion: string | undefined): string {
    return (
        `The TypeScript 7 extension${extensionVersion ? ` (${extensionVersion})` : ''} is too old for Svelte files: ` +
        'version 1.0.2 or newer is needed. ' +
        fallbackNote
    );
}
