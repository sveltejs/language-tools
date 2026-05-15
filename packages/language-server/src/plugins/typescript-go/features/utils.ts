import { internalHelpers } from 'svelte2tsx';
import { tsApiSync, tsAst } from '../types';

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
