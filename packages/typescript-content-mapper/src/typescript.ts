import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

/**
 * The environment variable that tells the mapper which TypeScript package parses the scripts:
 * a module specifier (resolved like the project's packages, e.g. `@typescript/native`)
 * or the absolute path of a TypeScript package directory. svelte-check sets it to the
 * TypeScript 7 it runs with. TypeScript passes its environment on to the mapper process.
 */
const TYPESCRIPT_ENV = 'SVELTE_CONTENT_MAPPER_TYPESCRIPT';

/**
 * Where the mapper looks for TypeScript when the environment variable isn't set:
 * the project's `typescript`, then the alias svelte-check documents for projects that
 * keep TypeScript 6 as `typescript` (`"@typescript/native": "npm:typescript@^7.1"`).
 */
const TYPESCRIPT_PACKAGE_NAMES = ['typescript', '@typescript/native'];

export interface FoundTypeScript {
    /** The directory of the TypeScript package */
    packageDir: string;
    version: string;
}

/**
 * Finds the TypeScript 7.1+ package that svelte2tsx parses the scripts with, so that it understands
 * the same syntax as the TypeScript 7 running the mapper. The protocol doesn't tell the mapper which
 * TypeScript started it, so it resolves the package names from `paths` (the directories to resolve
 * from: the project's, i.e. the tsconfig's, then the mapper's), with Node's resolution: in each
 * directory's `node_modules` and the ones above. A TypeScript installed elsewhere, e.g. next to or
 * below the tsconfig in a monorepo, isn't found; `SVELTE_CONTENT_MAPPER_TYPESCRIPT` is the way to
 * choose it.
 *
 * Throws an error that explains what was found if there's no suitable TypeScript.
 */
export function findTypeScript(
    paths: string[],
    env: Record<string, string | undefined> = process.env
): FoundTypeScript {
    const override = env[TYPESCRIPT_ENV];
    if (override) {
        const found = readPackage(override, paths);
        if (!found) {
            throw new Error(
                `${TYPESCRIPT_ENV} is set to '${override}', but no TypeScript package was found there.`
            );
        }
        if (!isAtLeast71(found.version)) {
            throw new Error(
                `${TYPESCRIPT_ENV} is set to '${override}', which is TypeScript ${found.version} (${found.packageDir}). ` +
                    'The Svelte content mapper needs TypeScript 7.1 or newer.'
            );
        }
        return found;
    }

    // Location by location (the project's first, then the mapper's), and each location with
    // both names: the mapper's own `typescript` must not win over the project's `@typescript/native`
    const tooOld: string[] = [];
    for (const location of paths) {
        for (const name of TYPESCRIPT_PACKAGE_NAMES) {
            const found = readPackage(name, [location]);
            if (found && isAtLeast71(found.version)) {
                return found;
            }
            const description =
                found && `'${name}' is TypeScript ${found.version} (${found.packageDir})`;
            if (description && !tooOld.includes(description)) {
                tooOld.push(description);
            }
        }
    }
    throw new Error(
        'The Svelte content mapper needs TypeScript 7.1 or newer to parse the scripts of Svelte files, ' +
            `as 'typescript' or as '@typescript/native' (npm:typescript@^7.1), or the path in ${TYPESCRIPT_ENV}. ` +
            (tooOld.length ? `Found: ${tooOld.join(', ')}.` : 'Found none.')
    );
}

function readPackage(specifier: string, paths: string[]): FoundTypeScript | undefined {
    let packageJsonPath: string;
    try {
        packageJsonPath = path.isAbsolute(specifier)
            ? path.join(specifier, 'package.json')
            : require.resolve(`${specifier}/package.json`, { paths });
        const { name, version } = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        // An alias like `@typescript/native` is a `typescript` package under another name
        if (name !== 'typescript' || typeof version !== 'string') {
            return undefined;
        }
        return { packageDir: path.dirname(packageJsonPath), version };
    } catch {
        return undefined;
    }
}

export function isAtLeast71(version: string): boolean {
    const [major, minor] = version.split('.').map((part) => parseInt(part, 10));
    return major > 7 || (major === 7 && minor >= 1);
}
