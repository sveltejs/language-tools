import type ts from 'typescript';

/**
 * The type guards of the TypeScript API that svelte2tsx uses.
 * This is a runtime list so that an implementation can check that it provides all of them.
 */
export const facadeGuards = [
    'isArrayBindingPattern',
    'isArrayLiteralExpression',
    'isArrowFunction',
    'isAsExpression',
    'isAwaitExpression',
    'isBinaryExpression',
    'isBindingElement',
    'isBlock',
    'isCallExpression',
    'isClassDeclaration',
    'isComputedPropertyName',
    'isConditionalExpression',
    'isElementAccessExpression',
    'isEnumDeclaration',
    'isExportDeclaration',
    'isExpressionStatement',
    'isForInStatement',
    'isForOfStatement',
    'isForStatement',
    'isFunctionDeclaration',
    'isFunctionExpression',
    'isFunctionLike',
    'isIdentifier',
    'isIfStatement',
    'isImportClause',
    'isImportDeclaration',
    'isImportEqualsDeclaration',
    'isImportSpecifier',
    'isImportTypeNode',
    'isIndexSignatureDeclaration',
    'isInterfaceDeclaration',
    'isIntersectionTypeNode',
    'isLabeledStatement',
    'isLiteralTypeNode',
    'isModuleDeclaration',
    'isNamedExports',
    'isNamedImports',
    'isNamespaceImport',
    'isNumericLiteral',
    'isObjectBindingPattern',
    'isObjectLiteralExpression',
    'isOmittedExpression',
    'isParameter',
    'isParenthesizedExpression',
    'isPropertyAccessExpression',
    'isPropertyAssignment',
    'isPropertyDeclaration',
    'isPropertySignature',
    'isSatisfiesExpression',
    'isShorthandPropertyAssignment',
    'isSourceFile',
    'isSpreadAssignment',
    'isSpreadElement',
    'isStringLiteral',
    'isStringLiteralLike',
    'isTypeAliasDeclaration',
    'isTypeAssertionExpression',
    'isTypeLiteralNode',
    'isTypeQueryNode',
    'isTypeReferenceNode',
    'isVariableDeclaration',
    'isVariableDeclarationList',
    'isVariableStatement',
    'isWhileStatement'
] as const;

/**
 * The other functions and the enums of the TypeScript API that svelte2tsx uses.
 */
export const facadeMembers = [
    ...facadeGuards,
    'SyntaxKind',
    'NodeFlags',
    'ScriptKind',
    'ScriptTarget',
    'createSourceFile',
    'createScanner',
    'forEachChild',
    'forEachLeadingCommentRange',
    'getLeadingCommentRanges',
    'getAllJSDocTagsOfKind',
    'getJSDocTags',
    'getJSDocParameterTags',
    'getJSDocType',
    'getModifiers',
    'canHaveModifiers',
    'isWhiteSpaceLike',
    'isWhiteSpaceSingleLine'
] as const;

/**
 * The part of the TypeScript API that svelte2tsx needs. svelte2tsx only uses TypeScript as a parser:
 * it parses the contents of the script tags, walks their AST and looks at tokens and comments.
 *
 * The signatures are the ones of TypeScript 6, so its `ts` namespace satisfies this interface as is
 * (see `ts-facade.ts`). The TypeScript 7 implementation (see `tsgo-facade.ts`) adapts the TypeScript 7 API to it.
 *
 * Rules for the code using it:
 * - Never import `typescript` at runtime (only `import type`); get the facade passed in instead,
 *   as a function parameter (`ts` by convention, so the code reads like before) or a constructor parameter.
 * - Read enum values (`SyntaxKind`, `NodeFlags`, ...) from the facade and never hard-code their numbers:
 *   they differ between TypeScript 6 and 7 (e.g. `SyntaxKind.Identifier` is 80 in TS6 and 79 in TS7).
 * - The node types are the ones of TypeScript 6. TypeScript 7's nodes are structurally compatible for the
 *   members svelte2tsx uses (`pos`, `end`, `parent`, `getStart()`, `getText()`, `getChildren()`, ...),
 *   but not for everything. For example, TypeScript 7 nodes have no `escapedText` and their source files
 *   no `languageVersion`. When using a new node member, check that it exists in TypeScript 7, too.
 * - Adding a member to the facade means adding it to `facadeGuards`/`facadeMembers`,
 *   and to the TypeScript 7 implementation if it doesn't exist there under the same name and with the same semantics.
 */
export type TsFacade = Pick<typeof ts, (typeof facadeMembers)[number]>;
