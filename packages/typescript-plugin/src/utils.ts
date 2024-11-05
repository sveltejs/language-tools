import type ts from 'typescript/lib/tsserverlibrary';
import { SvelteSnapshot } from './svelte-snapshots';
import { dirname, join } from 'path';
type _ts = typeof ts;

export function isSvelteFilePath(filePath: string) {
    return filePath.endsWith('.svelte');
}

export function isVirtualSvelteFilePath(filePath: string) {
    return filePath.endsWith('.d.svelte.ts');
}

export function toRealSvelteFilePath(filePath: string) {
    return filePath.slice(0, -11 /* 'd.svelte.ts'.length */) + 'svelte';
}

export function toVirtualSvelteFilePath(svelteFilePath: string) {
    return isVirtualSvelteFilePath(svelteFilePath)
        ? svelteFilePath
        : svelteFilePath.slice(0, -6 /* 'svelte'.length */) + 'd.svelte.ts';
}

export function ensureRealSvelteFilePath(filePath: string) {
    return isVirtualSvelteFilePath(filePath) ? toRealSvelteFilePath(filePath) : filePath;
}

export function isNotNullOrUndefined<T>(val: T | undefined | null): val is T {
    return val !== undefined && val !== null;
}

/**
 * Checks if this a section that should be completely ignored
 * because it's purely generated.
 */
export function isInGeneratedCode(text: string, start: number, end: number) {
    const lineStart = text.lastIndexOf('\n', start);
    const lineEnd = text.indexOf('\n', end);
    const lastStart = text.substring(lineStart, start).lastIndexOf('/*Ωignore_startΩ*/');
    const lastEnd = text.substring(lineStart, start).lastIndexOf('/*Ωignore_endΩ*/');
    return lastStart > lastEnd && text.substring(end, lineEnd).includes('/*Ωignore_endΩ*/');
}

/**
 * Checks that this isn't a text span that should be completely ignored
 * because it's purely generated.
 */
export function isNoTextSpanInGeneratedCode(text: string, span: ts.TextSpan) {
    return !isInGeneratedCode(text, span.start, span.start + span.length);
}

/**
 * Replace all occurrences of a string within an object with another string,
 */
export function replaceDeep<T extends Record<string, any>>(
    obj: T,
    searchStr: string | RegExp,
    replacementStr: string
): T {
    return _replaceDeep(obj);

    function _replaceDeep(_obj: any): any {
        if (typeof _obj === 'string') {
            return _obj.replace(searchStr, replacementStr);
        }
        if (Array.isArray(_obj)) {
            return _obj.map((entry) => _replaceDeep(entry));
        }
        if (typeof _obj === 'object') {
            return Object.keys(_obj).reduce((_o, key) => {
                _o[key] = _replaceDeep(_obj[key]);
                return _o;
            }, {} as any);
        }
        return _obj;
    }
}

export function getConfigPathForProject(project: ts.server.Project) {
    return (
        (project as ts.server.ConfiguredProject).canonicalConfigFilePath ??
        (project.getCompilerOptions() as any).configFilePath
    );
}

export function isStoreVariableIn$storeDeclaration(text: string, varStart: number) {
    return (
        text.lastIndexOf('__sveltets_2_store_get(', varStart) ===
        varStart - '__sveltets_2_store_get('.length
    );
}

export function get$storeOffsetOf$storeDeclaration(text: string, storePosition: number) {
    return text.lastIndexOf(' =', storePosition) - 1;
}

type NodePredicate = (node: ts.Node) => boolean;
type NodeTypePredicate<T extends ts.Node> = (node: ts.Node) => node is T;

/**
 * Finds node exactly matching span {start, length}.
 */
export function findNodeAtSpan<T extends ts.Node>(
    node: ts.Node,
    span: { start: number; length: number },
    predicate?: NodeTypePredicate<T>
): T | void {
    const { start, length } = span;

    const end = start + length;

    for (const child of node.getChildren()) {
        const childStart = child.getStart();
        if (end <= childStart) {
            return;
        }

        const childEnd = child.getEnd();
        if (start >= childEnd) {
            continue;
        }

        if (start === childStart && end === childEnd) {
            if (!predicate) {
                return child as T;
            }
            if (predicate(child)) {
                return child;
            }
        }

        const foundInChildren = findNodeAtSpan(child, span, predicate);
        if (foundInChildren) {
            return foundInChildren;
        }
    }
}

/**
 * Finds node somewhere at position.
 */
export function findNodeAtPosition<T extends ts.Node>(
    node: ts.Node,
    pos: number,
    predicate?: NodeTypePredicate<T>
): T | void {
    for (const child of node.getChildren()) {
        const childStart = child.getStart();
        if (pos < childStart) {
            return;
        }

        const childEnd = child.getEnd();
        if (pos > childEnd) {
            continue;
        }

        const foundInChildren = findNodeAtPosition(child, pos, predicate);
        if (foundInChildren) {
            return foundInChildren;
        }

        if (!predicate) {
            return child as T;
        }
        if (predicate(child)) {
            return child;
        }
    }
}

/**
 * True if is `export const/let/function`
 */
export function isTopLevelExport(ts: _ts, node: ts.Node, source: ts.SourceFile) {
    return (
        (ts.isVariableStatement(node) && source.statements.includes(node as any)) ||
        (ts.isIdentifier(node) &&
            node.parent &&
            ts.isVariableDeclaration(node.parent) &&
            source.statements.includes(node.parent?.parent?.parent as any)) ||
        (ts.isIdentifier(node) &&
            node.parent &&
            ts.isFunctionDeclaration(node.parent) &&
            source.statements.includes(node.parent as any))
    );
}

const COMPONENT_SUFFIX = '__SvelteComponent_';

export function isGeneratedSvelteComponentName(className: string) {
    return className.endsWith(COMPONENT_SUFFIX);
}

export function offsetOfGeneratedComponentExport(snapshot: SvelteSnapshot) {
    return snapshot.getText().lastIndexOf(COMPONENT_SUFFIX);
}

export function gatherDescendants<T extends ts.Node>(
    node: ts.Node,
    predicate: NodeTypePredicate<T>,
    dest: T[] = []
) {
    if (predicate(node)) {
        dest.push(node);
    } else {
        for (const child of node.getChildren()) {
            gatherDescendants(child, predicate, dest);
        }
    }
    return dest;
}

export function findIdentifier(ts: _ts, node: ts.Node): ts.Identifier | undefined {
    if (ts.isIdentifier(node)) {
        return node;
    }

    if (ts.isFunctionDeclaration(node)) {
        return node.name;
    }

    while (node) {
        if (ts.isIdentifier(node)) {
            return node;
        }
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
            return node.name;
        }

        node = node.parent;
    }
}

export function getProjectDirectory(project: ts.server.Project) {
    const compilerOptions = project.getCompilerOptions();

    if (typeof compilerOptions.configFilePath === 'string') {
        return dirname(compilerOptions.configFilePath);
    }

    const packageJsonPath = join(project.getCurrentDirectory(), 'package.json');
    return project.fileExists(packageJsonPath) ? project.getCurrentDirectory() : undefined;
}

export function hasNodeModule(startPath: string, module: string) {
    try {
        const hasModule = require.resolve(module, { paths: [startPath] });
        return hasModule;
    } catch (e) {
        // If require.resolve fails, we end up here, which can be either because the package is not found,
        // or (in case of things like SvelteKit) the package is found but the package.json is not exported.
        return (e as any)?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED';
    }
}

export function isSvelteProject(project: ts.server.Project) {
    const projectDirectory = getProjectDirectory(project);
    if (projectDirectory) {
        return hasNodeModule(projectDirectory, 'svelte');
    }

    const packageJsons = project
        .readDirectory(
            project.getCurrentDirectory(),
            ['.json'],
            ['node_modules', 'dist', 'build'],
            ['**/package.json'],
            // assuming structure like packages/projectName
            3
        )
        // in case some other plugin patched readDirectory in a weird way
        .filter((file) => file.endsWith('package.json') && !hasConfigInConjunction(file, project));

    return packageJsons.some((packageJsonPath) =>
        hasNodeModule(dirname(packageJsonPath), 'svelte')
    );
}

function hasConfigInConjunction(packageJsonPath: string, project: ts.server.Project) {
    const dir = dirname(packageJsonPath);

    return (
        project.fileExists(join(dir, 'tsconfig.json')) ||
        project.fileExists(join(dir, 'jsconfig.json'))
    );
}

export function importSvelteCompiler(
    fromPath: string | undefined
): typeof import('svelte/compiler') | undefined {
    if (!fromPath) return undefined;

    try {
        const sveltePath = require.resolve('svelte/compiler', { paths: [fromPath] });
        const compiler = require(sveltePath);

        if (compiler.VERSION.split('.')[0] === '3') {
            // use built-in version for Svelte 3
            return undefined;
        }

        return compiler;
    } catch (e) {
        // ignore
    }
}
