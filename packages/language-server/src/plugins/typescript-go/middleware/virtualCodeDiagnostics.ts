import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { Document } from '../../../lib/documents';
import { TemplateAstWalker } from '../../svelte/TemplateASTLoader';
import { TsApiLocationMapper } from '../TsApiLocationMapper';
import type { TsApiAccess } from '../TsApiService';
import type { tsApiAsync, tsAst } from '../types';

/**
 * Problems inside unmapped virtual code, placed in the original file.
 *
 * TS7's LSP bundles them into one diagnostic (18080) at the start of the file, with no codes or
 * positions. The TS7 API reports them individually, with code and virtual position, so we can tell
 * from the svelte2tsx output what they are about, and where they belong (or that they are false
 * positives and can be dropped).
 */
export interface VirtualCodeRelocation {
    /** The relocated problems, in original positions */
    diagnostics: Diagnostic[];
    /** Messages of the relocated and dropped problems, to remove them from the related information of 18080 */
    handledMessages: string[];
    /** Every problem in unmapped virtual code was relocated or dropped, 18080 can go */
    complete: boolean;
}

/** "This location is in virtual code produced by the content mapper ... " */
const IN_VIRTUAL_CODE = 18074;
const NO_OVERLOAD_MATCHES_CALL = 2769;
const ARG_TYPE_X_NOT_ASSIGNABLE_TO_TYPE_Y = 2345;
const TYPE_X_NOT_ASSIGNABLE_TO_TYPE_Y = 2322;
const DEPRECATED = 6385;
const DEPRECATED_SIGNATURE = 6387;

const storeGetName = '__sveltets_2_store_get';
const ensureComponentName = '__sveltets_2_ensureComponent';

type ApiDiagnostic = tsApiAsync.Diagnostic;

export async function relocateVirtualCodeDiagnostics(
    api: TsApiAccess,
    document: Document,
    ast: TemplateAstWalker | undefined
): Promise<VirtualCodeRelocation | undefined> {
    return api.withSourceFile(document.uri, async (project, sourceFile) => {
        if (sourceFile.originalText !== document.getText()) {
            // TS7's snapshot doesn't match the document the report was computed for
            return undefined;
        }
        const file = { uri: document.uri };
        const all = (
            await Promise.all([
                project.program.getSyntacticDiagnostics(file),
                project.program.getSemanticDiagnostics(file),
                project.program.getSuggestionDiagnostics(file)
            ])
        ).flat();
        const unmapped = all.filter(
            (d) => d.fileName === sourceFile.fileName && d.pos >= 0 && isInVirtualCode(d)
        );

        const context = {
            api,
            project,
            sourceFile,
            document,
            ast,
            mapper: new TsApiLocationMapper(api.astModule)
        };
        const diagnostics: Diagnostic[] = [];
        const handledMessages: string[] = [];
        for (const diagnostic of unmapped) {
            if (isDeprecation(diagnostic)) {
                handledMessages.push(diagnostic.text);
                continue;
            }
            const relocated =
                (await relocateStoreMisuse(context, diagnostic)) ??
                relocateNonBindableError(context, diagnostic);
            if (relocated) {
                diagnostics.push(...relocated);
                handledMessages.push(diagnostic.text);
            } else if (isInIgnoreRegion(sourceFile.text, diagnostic.pos)) {
                handledMessages.push(diagnostic.text);
            }
        }
        return {
            diagnostics,
            handledMessages,
            complete: handledMessages.length === unmapped.length
        };
    });
}

interface RelocationContext {
    api: TsApiAccess;
    project: tsApiAsync.Project;
    sourceFile: tsAst.SourceFile;
    document: Document;
    ast: TemplateAstWalker | undefined;
    mapper: TsApiLocationMapper;
}

/** In unmapped virtual code: TS7 adds an 18074 note to the message chain, and its position is virtual */
export function isInVirtualCode(diagnostic: ApiDiagnostic): boolean {
    return (
        diagnostic.code === IN_VIRTUAL_CODE ||
        !!diagnostic.messageChain?.some((chained) => isInVirtualCode(chained))
    );
}

/**
 * Unmapped virtual code is generated, so a deprecation there is about what svelte2tsx uses, never
 * about the user's code. E.g. Svelte 5 deprecates the constructor and `$on` of class components,
 * but svelte2tsx uses them for components typed as classes (`new $$_ChildC({ ... })`,
 * `$$_Child.$on('event', ...)`), or `ComponentConstructorOptions` in the component's type.
 * TS6 dropped them, too (no source mapping). Deprecations are suggestions, which `Ignore`
 * directives don't drop. The counterpart of `isGeneratedDeprecation` in `diagnostics.ts`.
 */
function isDeprecation(diagnostic: ApiDiagnostic): boolean {
    return diagnostic.code === DEPRECATED || diagnostic.code === DEPRECATED_SIGNATURE;
}

const IGNORE_START_COMMENT = '/*Ωignore_startΩ*/';
const IGNORE_END_COMMENT = '/*Ωignore_endΩ*/';

/**
 * Inside a `/*Ωignore_startΩ*\/…/*Ωignore_endΩ*\/` region of svelte2tsx (purely generated code), like
 * TS6's `isInGeneratedCode`. svelte2tsx puts an `Ignore` directive over these regions, so only
 * diagnostics the directives don't cover arrive here: syntactic ones, suggestions, and the ones at
 * the argument of `__sveltets_2_store_get(x)`, which svelte2tsx leaves to the store misuse rule.
 */
function isInIgnoreRegion(text: string, position: number): boolean {
    // regions can be nested
    let depth = 0;
    let nextStart = text.indexOf(IGNORE_START_COMMENT);
    let nextEnd = text.indexOf(IGNORE_END_COMMENT);
    while (
        nextEnd !== -1 &&
        Math.min(nextEnd, nextStart === -1 ? nextEnd : nextStart) <= position
    ) {
        if (nextStart !== -1 && nextStart < nextEnd) {
            depth++;
            nextStart = text.indexOf(IGNORE_START_COMMENT, nextStart + 1);
        } else {
            depth = Math.max(0, depth - 1);
            nextEnd = text.indexOf(IGNORE_END_COMMENT, nextEnd + 1);
        }
    }
    return depth > 0 && nextEnd !== -1;
}

/**
 * Port of TS6's store check: `$x` of something that isn't a store fails inside the hidden
 * `let $x = __sveltets_2_store_get(x)`. Report it at every `$x` usage instead.
 */
async function relocateStoreMisuse(
    { api, project, sourceFile, mapper }: RelocationContext,
    diagnostic: ApiDiagnostic
): Promise<Diagnostic[] | undefined> {
    if (
        diagnostic.code !== NO_OVERLOAD_MATCHES_CALL &&
        diagnostic.code !== ARG_TYPE_X_NOT_ASSIGNABLE_TO_TYPE_Y
    ) {
        return undefined;
    }
    const ast = api.astModule;
    const store = ast.getTouchingToken(sourceFile, diagnostic.pos);
    const call = store?.parent;
    const declaration = call?.parent;
    if (
        !store ||
        !ast.isIdentifier(store) ||
        !call ||
        !ast.isCallExpression(call) ||
        !ast.isIdentifier(call.expression) ||
        call.expression.text !== storeGetName ||
        call.arguments[0]?.pos !== store.pos ||
        !declaration ||
        !ast.isVariableDeclaration(declaration)
    ) {
        return undefined;
    }

    const references = await project.languageService.getReferencedSymbolsForNode(
        declaration.name,
        declaration.name.getStart()
    );
    const usages = await Promise.all(
        references.flatMap((entry) => entry.references.map((reference) => reference.resolve()))
    );
    const storeName = store.text;
    const message =
        `Cannot use '${storeName}' as a store. '${storeName}' needs to be an object with a subscribe method on it.\n\n` +
        flattenMessage(diagnostic);
    const result: Diagnostic[] = [];
    for (const usage of usages) {
        const location = usage && mapper.toOriginalLocation(usage);
        if (location) {
            result.push(toDiagnostic(diagnostic, location.range, message));
        }
    }
    return result.length ? result : undefined;
}

/**
 * Port of TS6's `moveBindingErrorMessage`: `bind:x` on a component prop that isn't `$bindable()`
 * fails at `$$_child.$$bindings = 'x'` in the generated code. The component of that block is the
 * argument of its `__sveltets_2_ensureComponent(Child)`, which is mapped to the tag name.
 */
function relocateNonBindableError(
    { api, sourceFile, document, ast: templateAst, mapper }: RelocationContext,
    diagnostic: ApiDiagnostic
): Diagnostic[] | undefined {
    const text = sourceFile.text;
    if (
        diagnostic.code !== TYPE_X_NOT_ASSIGNABLE_TO_TYPE_Y ||
        !text.slice(diagnostic.pos, diagnostic.end).endsWith('.$$bindings') ||
        !templateAst ||
        templateAst.parserError
    ) {
        return undefined;
    }
    const name = /^\s*=\s*(['"])([^'"]*)\1/.exec(text.slice(diagnostic.end))?.[2];
    if (!name) {
        return undefined;
    }

    const ast = api.astModule;
    let block: tsAst.Node | undefined = ast.getTouchingToken(sourceFile, diagnostic.pos);
    while (block && !ast.isBlock(block)) {
        block = block.parent;
    }
    const componentName = block && findEnsureComponentArgument(api, block);
    const tagName = componentName && mapper.toOriginalLocation(componentName);
    if (!tagName) {
        return undefined;
    }

    let component: any;
    templateAst.walkSvelteAst({
        enter(node) {
            if (
                node.type === 'InlineComponent' &&
                node.start < tagName.start &&
                tagName.start < node.end
            ) {
                // innermost wins: nested components are visited after their parents
                component = node;
            }
        }
    });
    const binding = component?.attributes?.find(
        (attribute: any) => attribute.type === 'Binding' && attribute.name === name
    );
    if (!binding) {
        return undefined;
    }

    return [
        toDiagnostic(
            diagnostic,
            {
                start: document.positionAt(binding.start),
                end: document.positionAt(binding.end)
            },
            "Cannot use 'bind:' with this property. It is declared as non-bindable inside the component.\n" +
                `To mark a property as bindable: 'let { ${name} = $bindable() } = $props()'`
        )
    ];
}

/** `X` of `const $$_xC = __sveltets_2_ensureComponent(X);` in `block` */
function findEnsureComponentArgument(api: TsApiAccess, block: tsAst.Node) {
    const ast = api.astModule;
    if (!ast.isBlock(block)) {
        return undefined;
    }
    for (const statement of block.statements) {
        if (!ast.isVariableStatement(statement)) {
            continue;
        }
        for (const declaration of statement.declarationList.declarations) {
            const call = declaration.initializer;
            if (
                call &&
                ast.isCallExpression(call) &&
                ast.isIdentifier(call.expression) &&
                call.expression.text === ensureComponentName &&
                call.arguments[0]
            ) {
                return call.arguments[0];
            }
        }
    }
    return undefined;
}

function toDiagnostic(
    diagnostic: ApiDiagnostic,
    range: Diagnostic['range'],
    message: string
): Diagnostic {
    return {
        range,
        severity: toSeverity(diagnostic.category),
        source: 'ts',
        code: diagnostic.code,
        message
    };
}

/** TS `DiagnosticCategory`: Warning, Error, Suggestion, Message */
function toSeverity(category: number): DiagnosticSeverity {
    switch (category) {
        case 0:
            return DiagnosticSeverity.Warning;
        case 2:
            return DiagnosticSeverity.Hint;
        case 3:
            return DiagnosticSeverity.Information;
        default:
            return DiagnosticSeverity.Error;
    }
}

/** The message chain, without TS7's "this location is in virtual code" notes */
function flattenMessage(diagnostic: ApiDiagnostic, level = 0): string {
    const lines = [diagnostic.text];
    for (const chained of diagnostic.messageChain ?? []) {
        if (chained.code !== IN_VIRTUAL_CODE) {
            lines.push('  '.repeat(level + 1) + flattenMessage(chained, level + 1));
        }
    }
    return lines.join('\n');
}
