import { internalHelpers } from 'svelte2tsx';
import { tsAst } from '../types';
import { CancellationToken } from 'vscode-languageserver';

type NodePredicate = (tsAstModule: typeof tsAst, node: tsAst.Node) => boolean;
type NodeTypePredicate<T extends tsAst.Node> = (
    tsAstModule: typeof tsAst,
    node: tsAst.Node
) => node is T;

/**
 * https://github.com/microsoft/typescript-go/blob/2a5e1cf9fe2261f2ad56871a6d2ed12d6ac34083/internal/scanner/scanner.go#L2473
 * TODO: check if it's added to the ast package
 */
export function getStartOfNode(
    tsAstModule: typeof tsAst,
    node: tsAst.Node,
    sourceFile: tsAst.SourceFile
): number {
    if (nodeIsMissing(tsAstModule, node)) {
        return node.pos;
    }

    if (tsAstModule.isJSDoc(node) || node.kind === tsAstModule.SyntaxKind.JSDocText) {
        return tsAstModule.skipTrivia(
            sourceFile.text,
            node.pos,
            /*stopAfterLineBreak*/ false,
            /*stopAtComments*/ true
        );
    }

    return tsAstModule.skipTrivia(
        sourceFile.text,
        node.pos,
        /*stopAfterLineBreak*/ false,
        /*stopAtComments*/ false,
        /*inJSDoc*/ (node.flags & tsAstModule.NodeFlags.JSDoc) !== 0
    );
}

function nodeIsMissing(tsAstModule: typeof tsAst, node: tsAst.Node): boolean {
    return (
        !node ||
        (node.pos === node.end && node.pos >= 0 && node.kind !== tsAstModule.SyntaxKind.EndOfFile)
    );
}

export function findNodeAtOffsetRange(
    tsAstModule: typeof tsAst,
    sourceFile: tsAst.SourceFile,
    start: number,
    end: number
) {
    const nearest = tsAstModule.getTouchingToken(sourceFile, start);
    if (nearest.end != end) {
        let current: tsAst.Node | undefined = nearest;
        while (current) {
            if (current.end === end) {
                return current;
            }
            current = current.parent;
        }
    }
}

/**
 * Tests a node then its parent and successive ancestors for some respective predicates.
 */
function nodeAndParentsSatisfyRespectivePredicates<T extends tsAst.Node>(
    selfPredicate: NodePredicate | NodeTypePredicate<T>,
    ...predicates: NodePredicate[]
) {
    return (tsAstModule: typeof tsAst, node: tsAst.Node | undefined | void | null): node is T => {
        let next = node;
        return [selfPredicate, ...predicates].every((predicate) => {
            if (!next) {
                return false;
            }
            const current = next;
            next = next.parent;
            return predicate(tsAstModule, current);
        });
    };
}

const isRenderFunction = nodeAndParentsSatisfyRespectivePredicates<
    tsAst.FunctionDeclaration & { name: tsAst.Identifier }
>(
    (tsAstModule, node) =>
        tsAstModule.isFunctionDeclaration(node) && node?.name?.text === internalHelpers.renderName,
    (tsAstModule, node) => node.kind === tsAstModule.SyntaxKind.SourceFile
);

const isRenderFunctionBody = nodeAndParentsSatisfyRespectivePredicates(
    (tsAstModule, node) => tsAstModule.isBlock(node),
    isRenderFunction
);

export const isReactiveStatement =
    nodeAndParentsSatisfyRespectivePredicates<tsAst.LabeledStatement>(
        (tsAstModule, node) => tsAstModule.isLabeledStatement(node) && node.label.text === '$',
        or(
            // function $$render() {
            //     $: x2 = __sveltets_2_invalidate(() => x * x)
            // }
            isRenderFunctionBody,
            // function $$render() {
            //     ;() => {$: x, update();
            // }
            nodeAndParentsSatisfyRespectivePredicates(
                (tsAstModule, node) => tsAstModule.isBlock(node),
                (tsAstModule, node) => tsAstModule.isArrowFunction(node),
                (tsAstModule, node) => tsAstModule.isExpressionStatement(node),
                isRenderFunctionBody
            )
        )
    );

function or(...predicates: Array<NodePredicate>) {
    return (tsAstModule: typeof tsAst, node: tsAst.Node) =>
        predicates.some((predicate) => predicate(tsAstModule, node));
}

function isSomeAncestor(tsAstModule: typeof tsAst, node: tsAst.Node, predicate: NodePredicate) {
    for (let parent = node.parent; parent; parent = parent.parent) {
        if (predicate(tsAstModule, parent)) {
            return true;
        }
    }
    return false;
}

export const isInReactiveStatement = (tsAstModule: typeof tsAst, node: tsAst.Node) =>
    isSomeAncestor(tsAstModule, node, isReactiveStatement);

export function gatherDescendants<T extends tsAst.Node>(
    tsAstModule: typeof tsAst,
    node: tsAst.Node,
    predicate: NodeTypePredicate<T>,
    dest: T[] = []
) {
    if (predicate(tsAstModule, node)) {
        dest.push(node);
    } else {
        node.forEachChild((child) => {
            gatherDescendants(tsAstModule, child, predicate, dest);
        });
    }
    return dest;
}

export const gatherIdentifiers = (tsAstModule: typeof tsAst, node: tsAst.Node) =>
    gatherDescendants(tsAstModule, node, (tsAstModule, node) => tsAstModule.isIdentifier(node));

export function getDeclarationFromName(tsAstModule: typeof tsAst, name: tsAst.Node) {
    const parent = name.parent;
    if (!parent) {
        return undefined;
    }

    const { SyntaxKind } = tsAstModule;
    switch (name.kind) {
        case SyntaxKind.StringLiteral:
        case SyntaxKind.NoSubstitutionTemplateLiteral:
        case SyntaxKind.NumericLiteral:
            if (tsAstModule.isComputedPropertyName(parent)) {
                return parent.parent;
            }
            break;
        case SyntaxKind.Identifier:
            if (isDeclaration(tsAstModule, parent)) {
                return parent;
            } else if (tsAstModule.isQualifiedName(parent)) {
                const tag = parent.parent;
                return tsAstModule.isJSDocParameterTag(tag) && tag.name === parent
                    ? tag
                    : undefined;
            } else {
                // const binExp = parent.parent;
                // return tsAstModule.isBinaryExpression(binExp) &&
                //     tsAstModule.getAssignmentDeclarationKind(binExp) !==
                //         tsAstModule.AssignmentDeclarationKind.None &&
                //     ((binExp.left as tsAst.BindableStaticNameExpression).symbol || binExp.symbol) &&
                //     tsAstModule.getNameOfDeclaration(binExp) === name
                //     ? binExp
                //     : undefined;
            }
        case SyntaxKind.PrivateIdentifier:
            if (isDeclaration(tsAstModule, parent) && parent.name === name) {
                return parent;
            }
            break;
    }

    return undefined;
}

export function isDeclaration(
    tsAstModule: typeof tsAst,
    node: tsAst.Node
): node is tsAst.Declaration & { name?: tsAst.DeclarationName } {
    if (node.kind === tsAstModule.SyntaxKind.TypeParameter) {
        return node.parent && node.parent.kind !== tsAstModule.SyntaxKind.JSDocTemplateTag;
    }

    return isDeclarationKind(tsAstModule, node.kind);
}

function isDeclarationKind(tsAstModule: typeof tsAst, kind: tsAst.SyntaxKind) {
    const { SyntaxKind } = tsAstModule;
    return (
        kind === SyntaxKind.ArrowFunction ||
        kind === SyntaxKind.BindingElement ||
        kind === SyntaxKind.ClassDeclaration ||
        kind === SyntaxKind.ClassExpression ||
        kind === SyntaxKind.ClassStaticBlockDeclaration ||
        kind === SyntaxKind.Constructor ||
        kind === SyntaxKind.EnumDeclaration ||
        kind === SyntaxKind.EnumMember ||
        kind === SyntaxKind.ExportSpecifier ||
        kind === SyntaxKind.FunctionDeclaration ||
        kind === SyntaxKind.FunctionExpression ||
        kind === SyntaxKind.GetAccessor ||
        kind === SyntaxKind.ImportClause ||
        kind === SyntaxKind.ImportEqualsDeclaration ||
        kind === SyntaxKind.ImportSpecifier ||
        kind === SyntaxKind.InterfaceDeclaration ||
        kind === SyntaxKind.JsxAttribute ||
        kind === SyntaxKind.MethodDeclaration ||
        kind === SyntaxKind.MethodSignature ||
        kind === SyntaxKind.ModuleDeclaration ||
        kind === SyntaxKind.NamespaceExportDeclaration ||
        kind === SyntaxKind.NamespaceImport ||
        kind === SyntaxKind.NamespaceExport ||
        kind === SyntaxKind.Parameter ||
        kind === SyntaxKind.PropertyAssignment ||
        kind === SyntaxKind.PropertyDeclaration ||
        kind === SyntaxKind.PropertySignature ||
        kind === SyntaxKind.SetAccessor ||
        kind === SyntaxKind.ShorthandPropertyAssignment ||
        kind === SyntaxKind.TypeAliasDeclaration ||
        kind === SyntaxKind.TypeParameter ||
        kind === SyntaxKind.VariableDeclaration ||
        kind === SyntaxKind.JSDocTypedefTag ||
        kind === SyntaxKind.JSDocCallbackTag ||
        kind === SyntaxKind.JSDocPropertyTag ||
        kind === SyntaxKind.NamedTupleMember
    );
}

export async function waitWithCancellation<T>(
    promises: Promise<T>[],
    cancellationToken: CancellationToken | undefined
): Promise<T[]> {
    if (cancellationToken == null) {
        return await Promise.all(promises);
    }

    return await Promise.race([
        Promise.all(promises),
        new Promise<T[]>((resolve) => {
            cancellationToken?.onCancellationRequested(() => {
                resolve([]);
            });
        })
    ]);
}
