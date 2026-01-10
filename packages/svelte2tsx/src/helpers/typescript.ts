import type ts from 'typescript';

type _ts = typeof ts;

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
                            ts.isArrowFunction(declaration.initializer.expression.expression))) ||
                    (ts.isParenthesizedExpression(declaration.initializer) &&
                        (ts.isFunctionExpression(declaration.initializer.expression) ||
                            ts.isArrowFunction(declaration.initializer.expression))))
            ) {
                const node = ts.isSatisfiesExpression(declaration.initializer)
                    ? ((declaration.initializer.expression as ts.ParenthesizedExpression)
                          .expression as ts.FunctionExpression | ts.ArrowFunction)
                    : ts.isParenthesizedExpression(declaration.initializer)
                      ? (declaration.initializer.expression as
                            | ts.FunctionExpression
                            | ts.ArrowFunction)
                      : declaration.initializer;
                exports.set(declaration.name.getText(), {
                    type: 'function',
                    node,
                    hasTypeDefinition: hasTypeDefinition || hasTypedParameter(ts, node, isTsFile)
                });
            } else if (ts.isIdentifier(declaration.name)) {
                // TODO support `export const { x, y } = ...` ?
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
