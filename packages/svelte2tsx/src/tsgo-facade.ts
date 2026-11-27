import type ts from 'typescript';
import { facadeGuards, facadeMembers, type TsFacade } from './facade';

/**
 * The modules of TypeScript 7 (>= 7.1) the facade is built on.
 * They're passed in so that this module doesn't depend on where (and whether) TypeScript 7 is installed.
 */
export interface Ts7Modules {
    /** `typescript/ast` */
    ast: any;
    /** `typescript/sync` (only its `API` class is used) */
    sync: { API: new (options?: object) => Ts7Api };
}

/** The part of the `API` class of `typescript/sync` the facade uses */
export interface Ts7Api {
    createSourceFile(
        fileName: string,
        sourceText: string,
        options?: { scriptKind?: number }
    ): { readonly sourceFile: any; dispose(): void };
    close(): void;
}

export interface TsgoFacade extends TsFacade {
    /**
     * Closes the API process the facade spawned, if any. Using the facade afterwards spawns a new one.
     */
    dispose(): void;
}

/**
 * Creates the TypeScript 7 implementation of the facade.
 *
 * TypeScript 7 has no JavaScript parser. Parsing goes through the `typescript/sync` API to a
 * `tsc --api` child process, which sends back the AST in a binary format. `typescript/ast` decodes
 * it lazily on the JavaScript side, with nodes that have (mostly) the same API as TypeScript 6's
 * and its own `SyntaxKind` numbers. The facade spawns that process on the first parse.
 */
export function createTsgoFacade(modules: Ts7Modules): TsgoFacade {
    const { ast } = modules;
    const SK = ast.SyntaxKind;

    let api: Ts7Api | undefined;
    const getApi = (): Ts7Api => (api ??= new modules.sync.API({}));

    const kinds = (names: string[]) =>
        new Set<number>(names.map((name) => SK[name]).filter((kind) => kind !== undefined));
    // TypeScript 6's isFunctionLikeKind (without JSDocFunctionType, which TypeScript 7 doesn't have)
    const functionLikeKinds = kinds([
        'MethodSignature',
        'CallSignature',
        'JSDocSignature',
        'ConstructSignature',
        'IndexSignature',
        'FunctionType',
        'JSDocFunctionType',
        'ConstructorType',
        'FunctionDeclaration',
        'MethodDeclaration',
        'Constructor',
        'GetAccessor',
        'SetAccessor',
        'FunctionExpression',
        'ArrowFunction'
    ]);
    // TypeScript 6's canHaveModifiers
    const canHaveModifiersKinds = kinds([
        'TypeParameter',
        'Parameter',
        'PropertySignature',
        'PropertyDeclaration',
        'MethodSignature',
        'MethodDeclaration',
        'Constructor',
        'GetAccessor',
        'SetAccessor',
        'IndexSignature',
        'ConstructorType',
        'FunctionExpression',
        'ArrowFunction',
        'ClassExpression',
        'VariableStatement',
        'FunctionDeclaration',
        'ClassDeclaration',
        'InterfaceDeclaration',
        'TypeAliasDeclaration',
        'EnumDeclaration',
        'ModuleDeclaration',
        'ImportEqualsDeclaration',
        'ImportDeclaration',
        'ExportAssignment',
        'ExportDeclaration'
    ]);

    const getJSDocParameterTags = (param: any): any[] => {
        if (!param.name) {
            return [];
        }
        const tags = ast.getJSDocTags(param.parent).filter(ast.isJSDocParameterTag);
        if (ast.isIdentifier(param.name)) {
            const name = param.name.text;
            return tags.filter((tag: any) => ast.isIdentifier(tag.name) && tag.name.text === name);
        }
        const index = param.parent.parameters.indexOf(param);
        return index < tags.length ? [tags[index]] : [];
    };

    /** Members that TypeScript 7 doesn't have, or has under a different name or with a different signature */
    const adapted: Partial<Record<(typeof facadeMembers)[number], unknown>> = {
        isParameter: ast.isParameterDeclaration,
        isPropertySignature: ast.isPropertySignatureDeclaration,
        isTypeAssertionExpression: ast.isTypeAssertion,
        // not ast.isFunctionLikeDeclaration: TypeScript 6's isFunctionLike includes signatures
        isFunctionLike: (node: any) => !!node && functionLikeKinds.has(node.kind),
        isStringLiteralLike: (node: any) =>
            node.kind === SK.StringLiteral || node.kind === SK.NoSubstitutionTemplateLiteral,
        // Holes in array binding patterns (`[a, , b]`) are OmittedExpressions in TypeScript 6,
        // but BindingElements without a name in TypeScript 7
        isBindingElement: (node: any) => ast.isBindingElement(node) && !!node.name,
        isOmittedExpression: (node: any) =>
            ast.isOmittedExpression(node) || (ast.isBindingElement(node) && !node.name),
        forEachChild: (node: any, cbNode: any, cbNodes?: any) => node.forEachChild(cbNode, cbNodes),
        canHaveModifiers: (node: any) => canHaveModifiersKinds.has(node.kind),
        getModifiers: (node: any) => {
            const modifiers = node.modifiers?.filter(ast.isModifier);
            return modifiers?.length ? modifiers : undefined;
        },
        getJSDocParameterTags,
        getJSDocType: (node: any) => {
            let tag = ast.getJSDocTags(node).find(ast.isJSDocTypeTag);
            if (!tag && ast.isParameterDeclaration(node)) {
                tag = getJSDocParameterTags(node).find((tag) => !!tag.typeExpression);
            }
            return tag?.typeExpression?.type;
        },
        createSourceFile: (
            fileName: string,
            sourceText: string,
            _languageVersionOrOptions?: unknown,
            _setParentNodes?: boolean,
            scriptKind?: number
        ) => {
            const retained = getApi().createSourceFile(fileName, sourceText, {
                scriptKind: scriptKind ?? getScriptKindFromFileName(ast.ScriptKind, fileName)
            });
            // The AST is decoded on the JS side from the response and doesn't need the remote copy
            // (svelte2tsx only reads it, it never asks the checker), so release it right away.
            retained.dispose();
            return retained.sourceFile;
        },
        // TypeScript 7 has no language version and no error callback
        createScanner: (
            _languageVersion: unknown,
            skipTrivia: boolean,
            languageVariant?: number,
            textInitial?: string,
            _onError?: unknown,
            start?: number,
            length?: number
        ) => {
            const scanner = ast.createScanner(
                skipTrivia,
                languageVariant,
                textInitial,
                start,
                length
            );
            // deprecated alias that TypeScript 7 doesn't have anymore
            scanner.getTokenPos ??= () => scanner.getTokenStart();
            return scanner;
        }
    };

    const facade: Record<string, unknown> = {};
    for (const name of facadeMembers) {
        facade[name] = name in adapted ? adapted[name] : ast[name];
    }
    const missing = facadeMembers.filter((name) => facade[name] === undefined);
    if (missing.length) {
        throw new Error(
            `svelte2tsx: this TypeScript version lacks ${missing.join(', ')}. TypeScript 7.1 or newer is required.`
        );
    }
    for (const name of facadeGuards) {
        if (typeof facade[name] !== 'function') {
            throw new Error(`svelte2tsx: ${name} of this TypeScript version is not a function`);
        }
    }

    facade.dispose = () => {
        api?.close();
        api = undefined;
    };

    return facade as unknown as TsgoFacade;
}

function getScriptKindFromFileName(ScriptKind: typeof ts.ScriptKind, fileName: string): number {
    const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
    switch (ext) {
        case '.js':
        case '.cjs':
        case '.mjs':
            return ScriptKind.JS;
        case '.jsx':
            return ScriptKind.JSX;
        case '.tsx':
            return ScriptKind.TSX;
        case '.json':
            return ScriptKind.JSON;
        default:
            return ScriptKind.TS;
    }
}
