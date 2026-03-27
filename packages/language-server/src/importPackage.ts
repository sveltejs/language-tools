import { dirname, isAbsolute, join, resolve } from 'path';
import * as prettier from 'prettier';
import * as svelte from 'svelte/compiler';
import type ts from 'typescript';
import fs from 'fs';
import { Logger } from './logger';
import { normalizePath, urlToPath } from './utils';
import { WorkspaceFolder } from 'vscode-languageserver-types';

/**
 * Whether or not the current workspace can be trusted.
 * TODO rework this to a class which depends on the LsConfigManager
 * and inject that class into all places where it's needed (Document etc.)
 */
let isTrusted = true;

export function setIsTrusted(_isTrusted: boolean) {
    isTrusted = _isTrusted;
}

/**
 * This function encapsulates the require call in one place
 * so we can replace its content inside rollup builds
 * so it's not transformed.
 */
function dynamicRequire(dynamicFileToRequire: string): any {
    // prettier-ignore
    return require(dynamicFileToRequire);
}

export function getPackageInfo(packageName: string, fromPath: string, use_fallback = true) {
    const packageJSONPath = resolvePackageJson(packageName, fromPath, use_fallback);
    const { version } = dynamicRequire(packageJSONPath);
    const [major, minor, patch] = version.split('.');

    return {
        path: dirname(packageJSONPath),
        version: {
            full: version,
            major: Number(major),
            minor: Number(minor),
            patch: Number(patch)
        }
    };
}

function resolvePackageJson(packageName: string, fromPath: string, use_fallback = true) {
    const paths: string[] = [];
    if (isTrusted) {
        paths.push(fromPath);
    }
    if (use_fallback) {
        paths.push(__dirname);
    }

    const packageJSONPath = require.resolve(`${packageName}/package.json`, {
        paths
    });

    return packageJSONPath;
}

export function importPrettier(fromPath: string): typeof prettier {
    if (!Logger.isDebugEnabled()) {
        const pkgPath = resolvePackageJson('prettier', fromPath);
        return dynamicRequire(dirname(pkgPath));
    }
    const pkg = getPackageInfo('prettier', fromPath);
    const main = resolve(pkg.path);
    Logger.debug('Using Prettier v' + pkg.version.full, 'from', main);
    return dynamicRequire(main);
}

export function importSvelte(fromPath: string): typeof svelte {
    const pkg = getPackageInfo('svelte', fromPath);
    const main = resolve(pkg.path, 'compiler');
    Logger.debug('Using Svelte v' + pkg.version.full, 'from', main);
    if (pkg.version.major === 4) {
        return dynamicRequire(main + '.cjs');
    } else {
        return dynamicRequire(main);
    }
}

/** Can throw because no fallback guaranteed */
export function importSveltePreprocess(fromPath: string): any {
    // svelte-language-server doesn't have a dependency on svelte-preprocess so we can't provide a fallback
    const useFallback = false;
    if (!Logger.isDebugEnabled()) {
        const pkgPath = resolvePackageJson('svelte-preprocess', fromPath, useFallback);
        return dynamicRequire(dirname(pkgPath));
    }
    const pkg = getPackageInfo('svelte-preprocess', fromPath, useFallback);
    const main = resolve(pkg.path);
    Logger.debug('Using svelte-preprocess v' + pkg.version.full, 'from', main);
    return dynamicRequire(main);
}

export function importTypeScript(): typeof ts {
    if (!Logger.isDebugEnabled()) {
        return dynamicRequire('typescript');
    }
    const pkg = getPackageInfo('typescript', __dirname);
    const main = resolve(pkg.path);
    Logger.debug('Using TypeScript v' + pkg.version.full, 'from', main);
    return dynamicRequire(main);
}

export function tryImportTypeScriptForTsdk(
    tsdkPath: string | undefined,
    workspaceFolders: WorkspaceFolder[]
): typeof ts | undefined {
    if (!tsdkPath || !isTrusted) {
        return undefined;
    }

    try {
        if (isAbsolute(tsdkPath)) {
            const fullPath = tryFullPath(tsdkPath);
            if (fullPath) {
                return load(fullPath);
            }
        }

        const absolutePath = asAbsoluteWorkspacePath(tsdkPath);
        if (absolutePath) {
            const fullPath = tryFullPath(absolutePath);
            if (fullPath) {
                return load(fullPath);
            }
        }
        if (workspaceFolders.length === 1) {
            const workspaceRootPath = urlToPath(workspaceFolders[0].uri);
            if (workspaceRootPath) {
                const fullPath = tryFullPath(join(workspaceRootPath, tsdkPath));
                if (fullPath) {
                    return load(fullPath);
                }
            }
        }
    } catch (error) {
        Logger.error(`Failed to load TypeScript from tsdk path ${tsdkPath}:`, error);
        return undefined;
    }

    function tryFullPath(tsdkPath: string) {
        tsdkPath = normalizePath(tsdkPath);
        if (tsdkPath.endsWith('/')) {
            tsdkPath = tsdkPath.slice(0, -1);
        }
        // "node_modules/typescript/lib" or
        // "/path/to/typescript/built/local" (dev build from typescript repo)
        const pkgJsonPath = tsdkPath.endsWith('built/local')
            ? join(tsdkPath, '../../package.json')
            : join(tsdkPath, '../package.json');
        const data = fs.readFileSync(pkgJsonPath, 'utf-8');

        const pkg = JSON.parse(data);
        if (pkg.name !== 'typescript' || typeof pkg.version !== 'string') {
            Logger.error(
                `The provided tsdk path ${tsdkPath} does not point to a valid TypeScript installation.`
            );
            return;
        }

        const [majorVersion, minorVersion] = pkg.version
            .split('.')
            .map((part: string) => parseInt(part, 10));
        if (isNaN(majorVersion) || majorVersion < 5 || (majorVersion === 5 && minorVersion < 5)) {
            Logger.error(
                `The TypeScript version at ${tsdkPath} is unsupported. Please use at least TypeScript 5.5.`
            );
            return;
        }

        const fullPath = join(tsdkPath, 'typescript.js');
        if (!fs.existsSync(fullPath)) {
            Logger.error(
                `The provided tsdk path ${tsdkPath} does not point to a valid TypeScript installation.`
            );
            return;
        }

        return { fullPath, version: pkg.version };
    }

    function asAbsoluteWorkspacePath(relativePath: string): string | undefined {
        for (const root of workspaceFolders) {
            const rootPrefixes = [`./${root.name}/`, `${root.name}/`];
            for (const rootPrefix of rootPrefixes) {
                const path = urlToPath(root.uri);
                if (path && relativePath.startsWith(rootPrefix)) {
                    return join(path, relativePath.replace(rootPrefix, ''));
                }
            }
        }

        return undefined;
    }

    function load(info: { fullPath: string; version: string }) {
        const result = dynamicRequire(info.fullPath);
        Logger.debug('Using TypeScript v' + info.version + ' from tsdk configuration');
        return result;
    }
}
