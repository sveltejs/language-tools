import * as fs from 'fs';

/**
 * TypeScript version facts shared by the TypeScript 6 path (`ts6.ts`) and the TypeScript 7 path
 * (`ts7/`). Nothing in here loads TypeScript.
 */

/** The npm alias for TypeScript 7 while TypeScript 6 is installed as `typescript` */
export const TS7_ALIAS = '@typescript/native';

export interface ParsedVersion {
    major: number;
    minor: number;
}

export function parseVersion(version: string): ParsedVersion {
    const [major, minor] = version.split('.').map((part) => parseInt(part, 10));
    return { major, minor };
}

/** 7.1 or newer, the first version with content mappers */
export function isSupportedTypeScript7(version: ParsedVersion): boolean {
    return version.major > 7 || (version.major === 7 && version.minor >= 1);
}

/** How to install TypeScript 7.1 or higher: as `typescript`, or next to TypeScript 6 as the alias */
export const INSTALL_TYPESCRIPT_7 =
    'Install a TypeScript 7.1 or higher\n' +
    `or, to keep TypeScript 6 as \`typescript\`, next to it: npm install --save-dev ${TS7_ALIAS}@npm:typescript@^7.1`;

/**
 * The version of the `typescript` package svelte-check resolves from its own location, which its
 * default mode (TypeScript 5 or 6) loads with `require('typescript')`
 */
function findTypeScript(): { version: string; packageJsonPath: string } | undefined {
    try {
        const packageJsonPath = require.resolve('typescript/package.json');
        const version: string = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')).version ?? '';
        return { version, packageJsonPath };
    } catch {
        return undefined;
    }
}

/**
 * The version of `typescript` if it's TypeScript 7.1 or newer. Then svelte-check uses its
 * TypeScript 7 support (`--experimental-ts7`) without being asked, as its default mode can't run.
 */
export function getImpliedTypeScript7(): string | undefined {
    const typescript = findTypeScript();
    return typescript && isSupportedTypeScript7(parseVersion(typescript.version))
        ? typescript.version
        : undefined;
}

/**
 * Why the TypeScript 6 path (the default, and `--incremental`/`--tsgo`/`--tsgo-experimental-api`)
 * can't run, if it can't: it needs the JS compiler API of TypeScript 5 or 6. TypeScript 7.1 or
 * newer doesn't get here (see `getImpliedTypeScript7`), but TypeScript 7.0 does.
 */
export function getTypeScript6Problem(): string | undefined {
    const typescript = findTypeScript();
    if (!typescript) {
        return (
            'svelte-check requires TypeScript, but it could not find the `typescript` package. ' +
            // not `typescript@latest`, that's TypeScript 7.0, which works in neither mode
            'Install TypeScript 6 with: npm install --save-dev typescript@^6\n' +
            'For the experimental TypeScript 7 support, see https://github.com/sveltejs/language-tools/tree/master/packages/svelte-check#typescript-7-experimental'
        );
    }
    if (parseVersion(typescript.version).major < 7) {
        return undefined;
    }
    return (
        `svelte-check found TypeScript ${typescript.version} as \`typescript\` (${typescript.packageJsonPath}), which it doesn't support: ` +
        `its default mode needs TypeScript 5 or 6, its experimental TypeScript 7 support needs TypeScript 7.1 or higher.\n` +
        INSTALL_TYPESCRIPT_7 +
        '\nor install TypeScript 6: npm install --save-dev typescript@^6'
    );
}
