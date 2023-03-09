import type ts from 'typescript/lib/tsserverlibrary';
import { SvelteSnapshot } from './svelte-snapshots';
type _ts = typeof ts;

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

/**
 * Finds the top level const/let/function exports of a source file.
 */
export function findExports(ts: _ts, source: ts.SourceFile, isTsFile: boolean) {
    const exports = new Map<
        string,
        | {
              type: 'function';
              node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression;
              hasTypeDefinition: boolean;
          }
        | {
              type: 'var';
              node: ts.VariableDeclaration;
              hasTypeDefinition: boolean;
          }
    >();
    // TODO handle indirect exports?
    for (const statement of source.statements) {
        if (
            ts.isFunctionDeclaration(statement) &&
            statement.name &&
            ts.getModifiers(statement)?.[0]?.kind === ts.SyntaxKind.ExportKeyword
        ) {
            // export function x ...
            exports.set(statement.name.text, {
                type: 'function',
                node: statement,
                hasTypeDefinition: hasTypedParameter(ts, statement, isTsFile)
            });
        }
        if (
            ts.isVariableStatement(statement) &&
            statement.declarationList.declarations.length === 1 &&
            ts.getModifiers(statement)?.[0]?.kind === ts.SyntaxKind.ExportKeyword
        ) {
            // export const x = ...
            const declaration = statement.declarationList.declarations[0];
            const hasTypeDefinition =
                !!declaration.type ||
                (!isTsFile && !!ts.getJSDocType(declaration)) ||
                (!!declaration.initializer && ts.isSatisfiesExpression(declaration.initializer));

            if (
                declaration.initializer &&
                (ts.isFunctionExpression(declaration.initializer) ||
                    ts.isArrowFunction(declaration.initializer) ||
                    (ts.isSatisfiesExpression(declaration.initializer) &&
                        ts.isParenthesizedExpression(declaration.initializer.expression) &&
                        (ts.isFunctionExpression(declaration.initializer.expression.expression) ||
                            ts.isArrowFunction(declaration.initializer.expression.expression))))
            ) {
                const node = ts.isSatisfiesExpression(declaration.initializer)
                    ? ((declaration.initializer.expression as ts.ParenthesizedExpression)
                          .expression as ts.FunctionExpression | ts.ArrowFunction)
                    : declaration.initializer;
                exports.set(declaration.name.getText(), {
                    type: 'function',
                    node,
                    hasTypeDefinition: hasTypeDefinition || hasTypedParameter(ts, node, isTsFile)
                });
            } else {
                exports.set(declaration.name.getText(), {
                    type: 'var',
                    node: declaration,
                    hasTypeDefinition
                });
            }
        }
    }

    return exports;
}

function hasTypedParameter(
    ts: _ts,
    node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
    isTsFile: boolean
): boolean {
    return (
        !!node.parameters[0]?.type ||
        (!isTsFile &&
            (!!ts.getJSDocType(node) ||
                (node.parameters[0] && !!ts.getJSDocParameterTags(node.parameters[0]).length)))
    );
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
