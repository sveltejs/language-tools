import ts from 'typescript';

export function findExortKeyword(node: ts.Node) {
    return node.modifiers?.find((x) => x.kind == ts.SyntaxKind.ExportKeyword);
}
