import path from 'path';
import type ts from 'typescript';

export type RewriteExternalImportsOptions = {
    sourcePath: string;
    generatedPath: string;
    workspacePath: string;
};

export type ExternalImportRewrite = {
    rewritten: string;
    insertedPrefix: string;
};

function toPosixPath(value: string): string {
    return value.replace(/\\/g, '/');
}

function isWithinDirectory(filePath: string, directoryPath: string): boolean {
    const relative = path.relative(path.resolve(directoryPath), path.resolve(filePath));
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function splitImportSpecifier(specifier: string): { pathPart: string; suffix: string } {
    const queryIndex = specifier.indexOf('?');
    const hashIndex = specifier.indexOf('#');
    const cutIndex =
        queryIndex === -1
            ? hashIndex
            : hashIndex === -1
              ? queryIndex
              : Math.min(queryIndex, hashIndex);

    if (cutIndex === -1) {
        return { pathPart: specifier, suffix: '' };
    }

    return {
        pathPart: specifier.slice(0, cutIndex),
        suffix: specifier.slice(cutIndex)
    };
}

export function getExternalImportRewrite(
    specifier: string,
    options: RewriteExternalImportsOptions
): ExternalImportRewrite | null {
    const sourceDir = path.dirname(options.sourcePath);
    const generatedDir = path.dirname(options.generatedPath);
    const { pathPart, suffix } = splitImportSpecifier(specifier);
    if (!pathPart.startsWith('../')) {
        return null;
    }

    const targetPath = path.resolve(sourceDir, pathPart);
    if (isWithinDirectory(targetPath, options.workspacePath)) {
        return null;
    }

    const rewrittenRelative = toPosixPath(path.relative(generatedDir, targetPath));
    const rewritten = `${rewrittenRelative}${suffix}`;
    if (rewritten === specifier) {
        return null;
    }

    return {
        rewritten,
        insertedPrefix: rewrittenRelative.slice(0, rewrittenRelative.length - pathPart.length)
    };
}

export function getImportTypeSpecifierLiteral(
    ts_impl: typeof ts,
    node: ts.ImportTypeNode
): ts.StringLiteralLike | undefined {
    const argument = node.argument;
    if (ts_impl.isLiteralTypeNode(argument) && ts_impl.isStringLiteralLike(argument.literal)) {
        return argument.literal;
    }
    return undefined;
}

function rewriteImportTypesInNode(
    ts_impl: typeof ts,
    node: ts.Node,
    applyImportRewrite: (module_specifier: ts.StringLiteralLike) => void
) {
    if (ts_impl.isImportTypeNode(node)) {
        const specifier = getImportTypeSpecifierLiteral(ts_impl, node);
        if (specifier) {
            applyImportRewrite(specifier);
        }
    }
    ts_impl.forEachChild(node, (child) =>
        rewriteImportTypesInNode(ts_impl, child, applyImportRewrite)
    );
}

export function rewriteExternalImportsInNode(
    ts_impl: typeof ts,
    node: ts.Node,
    options: RewriteExternalImportsOptions,
    on_rewrite: (module_specifier: ts.StringLiteralLike, rewrite: ExternalImportRewrite) => void
) {
    const applyImportRewrite = (module_specifier: ts.StringLiteralLike) => {
        const rewrite = getExternalImportRewrite(module_specifier.text, options);
        if (rewrite) {
            on_rewrite(module_specifier, rewrite);
        }
    };

    if (ts_impl.isImportDeclaration(node) || ts_impl.isExportDeclaration(node)) {
        if (node.moduleSpecifier && ts_impl.isStringLiteralLike(node.moduleSpecifier)) {
            applyImportRewrite(node.moduleSpecifier);
        }
    } else if (ts_impl.isCallExpression(node)) {
        const firstArg = node.arguments[0];
        if (firstArg && ts_impl.isStringLiteralLike(firstArg)) {
            const isDynamicImport = node.expression.kind === ts_impl.SyntaxKind.ImportKeyword;
            const isRequireCall =
                ts_impl.isIdentifier(node.expression) && node.expression.text === 'require';
            if (isDynamicImport || isRequireCall) {
                applyImportRewrite(firstArg);
            }
        }
    } else if (ts_impl.isImportTypeNode(node)) {
        const specifier = getImportTypeSpecifierLiteral(ts_impl, node);
        if (specifier) {
            applyImportRewrite(specifier);
        }
    }

    const jsDoc = (node as ts.Node & { jsDoc?: ts.NodeArray<ts.JSDoc> }).jsDoc;
    if (jsDoc) {
        for (const doc of jsDoc) {
            rewriteImportTypesInNode(ts_impl, doc, applyImportRewrite);
        }
    }
}

export function forEachExternalImportRewrite(
    ts_impl: typeof ts,
    source: ts.SourceFile,
    options: RewriteExternalImportsOptions,
    on_rewrite: (module_specifier: ts.StringLiteralLike, rewrite: ExternalImportRewrite) => void
) {
    const visit = (node: ts.Node) => {
        rewriteExternalImportsInNode(ts_impl, node, options, on_rewrite);
        ts_impl.forEachChild(node, visit);
    };

    ts_impl.forEachChild(source, visit);
}
