import type ts from 'typescript/lib/tsserverlibrary';
import { SvelteSnapshot } from './svelte-snapshots';

export function isSvelteFilePath(filePath: string) {
    return filePath.endsWith('.svelte');
}

export function isVirtualSvelteFilePath(filePath: string) {
    return filePath.endsWith('.svelte.ts');
}

export function toRealSvelteFilePath(filePath: string) {
    return filePath.slice(0, -'.ts'.length);
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

const COMPONENT_SUFFIX = '__SvelteComponent_';

export function isGeneratedSvelteComponentName(className: string) {
    return className.endsWith(COMPONENT_SUFFIX);
}

export function offsetOfGeneratedComponentExport(snapshot: SvelteSnapshot) {
    return snapshot.getText().lastIndexOf(COMPONENT_SUFFIX);
}

export function gatherDescendants<T extends ts.Node>(
    node: ts.Node,
    predicate: NodePredicate | NodeTypePredicate<T>,
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
