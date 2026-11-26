import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import type { TypeScript7Modules } from 'svelte-language-server/svelte-check-ts7';
import { SvelteCheckTs7Error } from 'svelte-language-server/svelte-check-ts7';
import {
    INSTALL_TYPESCRIPT_7,
    isSupportedTypeScript7,
    ParsedVersion,
    parseVersion,
    TS7_ALIAS
} from '../typescriptVersions';

export interface TypeScript7Package {
    /** How it's imported: `typescript` or the alias */
    moduleName: string;
    version: string;
    packageJsonPath: string;
}

interface FoundPackage extends TypeScript7Package {
    parsed: ParsedVersion;
}

/**
 * The project's TypeScript 7, resolved from the tsconfig directory: `typescript`, or
 * `@typescript/native`.
 *
 * Requires 7.1, the first version with content mappers. 7.0 ignores the tsconfig's
 * `contentMappers` and the API's `runExternalCode` without any error, so Svelte files would
 * silently not be checked.
 */
export function resolveTypeScript7(tsconfigPath: string): TypeScript7Package {
    const found = [findPackage('typescript', tsconfigPath), findPackage(TS7_ALIAS, tsconfigPath)];
    const supported = found.find((pkg) => pkg && isSupportedTypeScript7(pkg.parsed));
    if (supported) {
        const { parsed, ...pkg } = supported;
        return pkg;
    }

    const typescript7 = found.find((pkg) => pkg && pkg.parsed.major >= 7);
    const requirement = 'svelte-check --experimental-ts7 requires TypeScript 7.1 or higher';
    throw new SvelteCheckTs7Error(
        (typescript7
            ? `${requirement}, found ${typescript7.version} (${typescript7.packageJsonPath}). ` +
              'TypeScript 7.0 has no content mappers, so it would silently skip Svelte files.'
            : `${requirement} in the project, as \`typescript\` or as \`${TS7_ALIAS}\` (found ${
                  found
                      .filter((pkg): pkg is FoundPackage => !!pkg)
                      .map((pkg) => `${pkg.moduleName} ${pkg.version}`)
                      .join(', ') || 'none'
              }).`) +
            '\n' +
            INSTALL_TYPESCRIPT_7
    );
}

/** `typescript/async` and `typescript/ast` of the resolved package, so that they match its `tsc` */
export async function loadTypeScript7(
    pkg: TypeScript7Package,
    tsconfigPath: string
): Promise<TypeScript7Modules> {
    const [api, ast] = await Promise.all([
        importFromProject(`${pkg.moduleName}/async`, tsconfigPath),
        importFromProject(`${pkg.moduleName}/ast`, tsconfigPath)
    ]);
    if (typeof api?.API !== 'function' || !ast) {
        throw new SvelteCheckTs7Error(
            `Unsupported TypeScript version ${pkg.version} (${pkg.packageJsonPath}): it has no \`async\` API.`
        );
    }
    return { api, ast };
}

function findPackage(moduleName: string, tsconfigPath: string): FoundPackage | undefined {
    let packageJsonPath: string;
    try {
        packageJsonPath = require.resolve(`${moduleName}/package.json`, {
            paths: [path.dirname(tsconfigPath)]
        });
    } catch {
        return undefined;
    }
    const version: string = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')).version ?? '';
    return { moduleName, version, packageJsonPath, parsed: parseVersion(version) };
}

async function importFromProject(moduleName: string, tsconfigPath: string): Promise<any> {
    const modulePath = require.resolve(moduleName, { paths: [path.dirname(tsconfigPath)] });
    return import(pathToFileURL(modulePath).href);
}
