import ts from 'typescript';
import { CancellationToken, Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver';
import {
    Document,
    getNodeIfIsInStartTag,
    getTextInRange,
    isRangeInTag,
    mapRangeToOriginal
} from '../../../lib/documents';
import { DiagnosticsProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertRange, getDiagnosticTag, hasNonZeroRange, mapSeverity } from '../utils';
import { SvelteDocumentSnapshot } from '../DocumentSnapshot';
import {
    isInGeneratedCode,
    isAfterSvelte2TsxPropsReturn,
    findNodeAtSpan,
    isReactiveStatement,
    isInReactiveStatement,
    gatherIdentifiers,
    isStoreVariableIn$storeDeclaration,
    get$storeOffsetOf$storeDeclaration
} from './utils';
import { not, flatten, passMap, swapRangeStartEndIfNecessary, memoize } from '../../../utils';
import { LSConfigManager } from '../../../ls-config';
import { isAttributeName, isEventHandler } from '../svelte-ast-utils';

export enum DiagnosticCode {
    MODIFIERS_CANNOT_APPEAR_HERE = 1184, // "Modifiers cannot appear here."
    USED_BEFORE_ASSIGNED = 2454, // "Variable '{0}' is used before being assigned."
    JSX_ELEMENT_DOES_NOT_SUPPORT_ATTRIBUTES = 2607, // "JSX element class does not support attributes because it does not have a '{0}' property."
    CANNOT_BE_USED_AS_JSX_COMPONENT = 2786, // "'{0}' cannot be used as a JSX component."
    NOOP_IN_COMMAS = 2695, // "Left side of comma operator is unused and has no side effects."
    NEVER_READ = 6133, // "'{0}' is declared but its value is never read."
    ALL_IMPORTS_UNUSED = 6192, // "All imports in import declaration are unused."
    UNUSED_LABEL = 7028, // "Unused label."
    DUPLICATED_JSX_ATTRIBUTES = 17001, // "JSX elements cannot have multiple attributes with the same name."
    DUPLICATE_IDENTIFIER = 2300, // "Duplicate identifier 'xxx'"
    MULTIPLE_PROPS_SAME_NAME = 1117, // "An object literal cannot have multiple properties with the same name in strict mode."
    ARG_TYPE_X_NOT_ASSIGNABLE_TO_TYPE_Y = 2345, // "Argument of type '..' is not assignable to parameter of type '..'."
    TYPE_X_NOT_ASSIGNABLE_TO_TYPE_Y = 2322, // "Type '..' is not assignable to type '..'."
    TYPE_X_NOT_ASSIGNABLE_TO_TYPE_Y_DID_YOU_MEAN = 2820, // "Type '..' is not assignable to type '..'. Did you mean '...'?"
    UNKNOWN_PROP = 2353, // "Object literal may only specify known properties, and '...' does not exist in type '...'"
    MISSING_PROPS = 2739, // "Type '...' is missing the following properties from type '..': ..."
    MISSING_PROP = 2741, // "Property '..' is missing in type '..' but required in type '..'."
    NO_OVERLOAD_MATCHES_CALL = 2769, // "No overload matches this call"
    CANNOT_FIND_NAME = 2304, // "Cannot find name 'xxx'"
    CANNOT_FIND_NAME_X_DID_YOU_MEAN_Y = 2552, // "Cannot find name '...' Did you mean '...'?"
    EXPECTED_N_ARGUMENTS = 2554, // Expected {0} arguments, but got {1}.
    DEPRECATED_SIGNATURE = 6387 // The signature '..' of '..' is deprecated
}

export class DiagnosticsProviderImpl implements DiagnosticsProvider {
    constructor(
        private readonly lsAndTsDocResolver: LSAndTSDocResolver,
        private configManager: LSConfigManager
    ) {}

    async getDiagnostics(
        document: Document,
        cancellationToken?: CancellationToken
    ): Promise<Diagnostic[]> {
        const { lang, tsDoc } = await this.getLSAndTSDoc(document);

        if (
            ['coffee', 'coffeescript'].includes(document.getLanguageAttribute('script')) ||
            cancellationToken?.isCancellationRequested
        ) {
            return [];
        }

        const isTypescript =
            tsDoc.scriptKind === ts.ScriptKind.TSX || tsDoc.scriptKind === ts.ScriptKind.TS;

        // Document preprocessing failed, show parser error instead
        if (tsDoc.parserError) {
            return [
                {
                    range: tsDoc.parserError.range,
                    severity: DiagnosticSeverity.Error,
                    source: isTypescript ? 'ts' : 'js',
                    message: tsDoc.parserError.message,
                    code: tsDoc.parserError.code
                }
            ];
        }

        let diagnostics: ts.Diagnostic[] = lang.getSyntacticDiagnostics(tsDoc.filePath);
        const checkers = [lang.getSuggestionDiagnostics, lang.getSemanticDiagnostics];

        for (const checker of checkers) {
            if (cancellationToken) {
                // wait a bit so the event loop can check for cancellation
                // or let completion go first
                await new Promise((resolve) => setTimeout(resolve, 10));
                if (cancellationToken.isCancellationRequested) {
                    return [];
                }
            }
            diagnostics.push(...checker.call(lang, tsDoc.filePath));
        }

        const additionalStoreDiagnostics: ts.Diagnostic[] = [];
        const notGenerated = isNotGenerated(tsDoc.getFullText());
        for (const diagnostic of diagnostics) {
            if (
                (diagnostic.code === DiagnosticCode.NO_OVERLOAD_MATCHES_CALL ||
                    diagnostic.code === DiagnosticCode.ARG_TYPE_X_NOT_ASSIGNABLE_TO_TYPE_Y) &&
                !notGenerated(diagnostic)
            ) {
                if (isStoreVariableIn$storeDeclaration(tsDoc.getFullText(), diagnostic.start!)) {
                    const storeName = tsDoc
                        .getFullText()
                        .substring(diagnostic.start!, diagnostic.start! + diagnostic.length!);
                    const storeUsages = lang.findReferences(
                        tsDoc.filePath,
                        get$storeOffsetOf$storeDeclaration(tsDoc.getFullText(), diagnostic.start!)
                    )![0].references;
                    for (const storeUsage of storeUsages) {
                        additionalStoreDiagnostics.push({
                            ...diagnostic,
                            messageText: `Cannot use '${storeName}' as a store. '${storeName}' needs to be an object with a subscribe method on it.\n\n${ts.flattenDiagnosticMessageText(
                                diagnostic.messageText,
                                '\n'
                            )}`,
                            start: storeUsage.textSpan.start,
                            length: storeUsage.textSpan.length
                        });
                    }
                }
            }
        }
        diagnostics.push(...additionalStoreDiagnostics);

        diagnostics = diagnostics
            .filter(notGenerated)
            .filter(not(isUnusedReactiveStatementLabel))
            .filter((diagnostics) => !expectedTransitionThirdArgument(diagnostics, tsDoc, lang));

        diagnostics = resolveNoopsInReactiveStatements(lang, diagnostics);

        const mapRange = rangeMapper(tsDoc, document, lang);
        const noFalsePositive = isNoFalsePositive(document, tsDoc);
        const converted: Diagnostic[] = [];

        for (const tsDiag of diagnostics) {
            let diagnostic: Diagnostic = {
                range: convertRange(tsDoc, tsDiag),
                severity: mapSeverity(tsDiag.category),
                source: isTypescript ? 'ts' : 'js',
                message: ts.flattenDiagnosticMessageText(tsDiag.messageText, '\n'),
                code: tsDiag.code,
                tags: getDiagnosticTag(tsDiag)
            };
            diagnostic = mapRange(diagnostic);

            moveBindingErrorMessage(tsDiag, tsDoc, diagnostic, document);

            if (!hasNoNegativeLines(diagnostic) || !noFalsePositive(diagnostic)) {
                continue;
            }

            diagnostic = adjustIfNecessary(diagnostic, tsDoc.isSvelte5Plus);
            diagnostic = swapDiagRangeStartEndIfNecessary(diagnostic);
            converted.push(diagnostic);
        }

        return converted;
    }

    private async getLSAndTSDoc(document: Document) {
        return this.lsAndTsDocResolver.getLSAndTSDoc(document);
    }
}

function moveBindingErrorMessage(
    tsDiag: ts.Diagnostic,
    tsDoc: SvelteDocumentSnapshot,
    diagnostic: Diagnostic,
    document: Document
) {
    if (
        tsDiag.code === DiagnosticCode.TYPE_X_NOT_ASSIGNABLE_TO_TYPE_Y &&
        tsDiag.start &&
        tsDoc.getText(tsDiag.start, tsDiag.start + tsDiag.length!).endsWith('.$$bindings')
    ) {
        let node = tsDoc.svelteNodeAt(diagnostic.range.start);
        while (node && node.type !== 'InlineComponent') {
            node = node.parent!;
        }
        if (node) {
            let name = tsDoc.getText(
                tsDiag.start + tsDiag.length!,
                tsDiag.start + tsDiag.length! + 100
            );
            const quoteIdx = name.indexOf("'");
            name = name.substring(quoteIdx + 1, name.indexOf("'", quoteIdx + 1));
            const binding: any = node.attributes.find(
                (attr: any) => attr.type === 'Binding' && attr.name === name
            );
            if (binding) {
                // try to make the error more readable for english users
                if (
                    diagnostic.message.startsWith("Type '") &&
                    diagnostic.message.includes("is not assignable to type '")
                ) {
                    const idx = diagnostic.message.indexOf(`Type '"`) + `Type '"`.length;
                    const propName = diagnostic.message.substring(
                        idx,
                        diagnostic.message.indexOf('"', idx)
                    );
                    diagnostic.message =
                        "Cannot use 'bind:' with this property. It is declared as non-bindable inside the component.\n" +
                        `To mark a property as bindable: 'let { ${propName} = $bindable() } = $props()'`;
                } else {
                    diagnostic.message =
                        "Cannot use 'bind:' with this property. It is declared as non-bindable inside the component.\n" +
                        `To mark a property as bindable: 'let { prop = $bindable() } = $props()'\n\n` +
                        diagnostic.message;
                }
                diagnostic.range = {
                    start: document.positionAt(binding.start),
                    end: document.positionAt(binding.end)
                };
            }
        }
    }
}

function rangeMapper(
    snapshot: SvelteDocumentSnapshot,
    document: Document,
    lang: ts.LanguageService
): (value: Diagnostic) => Diagnostic {
    const get$$PropsDefWithCache = memoize(() => get$$PropsDef(lang, snapshot));
    const get$$PropsAliasInfoWithCache = memoize(() =>
        get$$PropsAliasForInfo(get$$PropsDefWithCache, lang, document)
    );

    return (diagnostic) => {
        let range = mapRangeToOriginal(snapshot, diagnostic.range);

        if (range.start.line < 0) {
            range =
                movePropsErrorRangeBackIfNecessary(
                    diagnostic,
                    snapshot,
                    get$$PropsDefWithCache,
                    get$$PropsAliasInfoWithCache
                ) ?? range;
        }

        if (
            ([DiagnosticCode.MISSING_PROP, DiagnosticCode.MISSING_PROPS].includes(
                diagnostic.code as number
            ) ||
                (DiagnosticCode.TYPE_X_NOT_ASSIGNABLE_TO_TYPE_Y &&
                    diagnostic.message.includes("'Properties<"))) &&
            !hasNonZeroRange({ range })
        ) {
            const node = getNodeIfIsInStartTag(document.html, document.offsetAt(range.start));
            if (node) {
                // This is a "some prop missing" error on a component -> remap
                range.start = document.positionAt(node.start + 1);
                range.end = document.positionAt(node.start + 1 + (node.tag?.length || 1));
            }
        }

        return { ...diagnostic, range };
    };
}

function findDiagnosticNode(diagnostic: ts.Diagnostic) {
    const { file, start, length } = diagnostic;
    if (!file || !start || !length) {
        return;
    }
    const span = { start, length };
    return findNodeAtSpan(file, span);
}

function copyDiagnosticAndChangeNode(diagnostic: ts.Diagnostic) {
    return (node: ts.Node) => ({
        ...diagnostic,
        start: node.getStart(),
        length: node.getWidth()
    });
}

/**
 * In some rare cases mapping of diagnostics does not work and produces negative lines.
 * We filter out these diagnostics with negative lines because else the LSP
 * apparently has a hickup and does not show any diagnostics at all.
 */
function hasNoNegativeLines(diagnostic: Diagnostic): boolean {
    return diagnostic.range.start.line >= 0 && diagnostic.range.end.line >= 0;
}

const generatedVarRegex = /'\$\$_\w+(\.\$on)?'/;

function isNoFalsePositive(document: Document, tsDoc: SvelteDocumentSnapshot) {
    const text = document.getText();
    const usesPug = document.getLanguageAttribute('template') === 'pug';

    return (diagnostic: Diagnostic) => {
        if (
            [DiagnosticCode.MULTIPLE_PROPS_SAME_NAME, DiagnosticCode.DUPLICATE_IDENTIFIER].includes(
                diagnostic.code as number
            )
        ) {
            const node = tsDoc.svelteNodeAt(diagnostic.range.start);
            if (isAttributeName(node, 'Element') || isEventHandler(node, 'Element')) {
                return false;
            }
        }

        if (
            diagnostic.code === DiagnosticCode.DEPRECATED_SIGNATURE &&
            generatedVarRegex.test(diagnostic.message)
        ) {
            // Svelte 5: $on and constructor is deprecated, but we don't want to show this warning for generated code
            return false;
        }

        return (
            isNoUsedBeforeAssigned(diagnostic, text, tsDoc) &&
            (!usesPug || isNoPugFalsePositive(diagnostic, document))
        );
    };
}

/**
 * All diagnostics inside the template tag and the unused import/variable diagnostics
 * are marked as false positive.
 */
function isNoPugFalsePositive(diagnostic: Diagnostic, document: Document): boolean {
    return (
        !isRangeInTag(diagnostic.range, document.templateInfo) &&
        diagnostic.code !== DiagnosticCode.NEVER_READ &&
        diagnostic.code !== DiagnosticCode.ALL_IMPORTS_UNUSED
    );
}

/**
 * Variable used before being assigned, can happen when  you do `export let x`
 * without assigning a value in strict mode. Should not throw an error here
 * but on the component-user-side ("you did not set a required prop").
 */
function isNoUsedBeforeAssigned(
    diagnostic: Diagnostic,
    text: string,
    tsDoc: SvelteDocumentSnapshot
): boolean {
    if (diagnostic.code !== DiagnosticCode.USED_BEFORE_ASSIGNED) {
        return true;
    }

    return !tsDoc.hasProp(getTextInRange(diagnostic.range, text));
}

/**
 * Some diagnostics have JSX-specific or confusing nomenclature. Enhance/adjust them for more clarity.
 */
function adjustIfNecessary(diagnostic: Diagnostic, isSvelte5Plus: boolean): Diagnostic {
    if (
        diagnostic.code === DiagnosticCode.ARG_TYPE_X_NOT_ASSIGNABLE_TO_TYPE_Y &&
        diagnostic.message.includes('ConstructorOfATypedSvelteComponent')
    ) {
        return {
            ...diagnostic,
            message:
                diagnostic.message +
                '\n\nPossible causes:\n' +
                '- You use the instance type of a component where you should use the constructor type\n' +
                '- Type definitions are missing for this Svelte Component. ' +
                (isSvelte5Plus
                    ? ''
                    : 'If you are using Svelte 3.31+, use SvelteComponentTyped to add a definition:\n' +
                      '  import type { SvelteComponentTyped } from "svelte";\n' +
                      '  class ComponentName extends SvelteComponentTyped<{propertyName: string;}> {}')
        };
    }

    if (diagnostic.code === DiagnosticCode.MODIFIERS_CANNOT_APPEAR_HERE) {
        return {
            ...diagnostic,
            message:
                diagnostic.message +
                '\nIf this is a declare statement, move it into <script context="module">..</script>'
        };
    }

    return diagnostic;
}

/**
 * Due to source mapping, some ranges may be swapped: Start is end. Swap back in this case.
 */
function swapDiagRangeStartEndIfNecessary(diag: Diagnostic): Diagnostic {
    diag.range = swapRangeStartEndIfNecessary(diag.range);
    return diag;
}

/**
 * Checks if diagnostic is not within a section that should be completely ignored
 * because it's purely generated.
 */
function isNotGenerated(text: string) {
    return (diagnostic: ts.Diagnostic) => {
        if (diagnostic.start === undefined || diagnostic.length === undefined) {
            return true;
        }
        return !isInGeneratedCode(text, diagnostic.start, diagnostic.start + diagnostic.length);
    };
}

function isUnusedReactiveStatementLabel(diagnostic: ts.Diagnostic) {
    if (diagnostic.code !== DiagnosticCode.UNUSED_LABEL) {
        return false;
    }

    const diagNode = findDiagnosticNode(diagnostic);
    if (!diagNode) {
        return false;
    }

    // TS warning targets the identifier
    if (!ts.isIdentifier(diagNode)) {
        return false;
    }

    if (!diagNode.parent) {
        return false;
    }
    return isReactiveStatement(diagNode.parent);
}

/**
 * Checks if diagnostics should be ignored because they report an unused expression* in
 * a reactive statement, and those actually have side effects in Svelte (hinting deps).
 *
 *     $: x, update()
 *
 * Only `let` (i.e. reactive) variables are ignored. For the others, new diagnostics are
 * emitted, centered on the (non reactive) identifiers in the initial warning.
 */
function resolveNoopsInReactiveStatements(lang: ts.LanguageService, diagnostics: ts.Diagnostic[]) {
    const isLet = (file: ts.SourceFile) => (node: ts.Node) => {
        const defs = lang.getDefinitionAtPosition(file.fileName, node.getStart());
        return !!defs && defs.some((def) => def.fileName === file.fileName && def.kind === 'let');
    };

    const expandRemainingNoopWarnings = (diagnostic: ts.Diagnostic): void | ts.Diagnostic[] => {
        const { code, file } = diagnostic;

        // guard: missing info
        if (!file) {
            return;
        }

        // guard: not target error
        const isNoopDiag = code === DiagnosticCode.NOOP_IN_COMMAS;
        if (!isNoopDiag) {
            return;
        }

        const diagNode = findDiagnosticNode(diagnostic);
        if (!diagNode) {
            return;
        }

        if (!isInReactiveStatement(diagNode)) {
            return;
        }

        return (
            // for all identifiers in diagnostic node
            gatherIdentifiers(diagNode)
                // ignore `let` (i.e. reactive) variables
                .filter(not(isLet(file)))
                // and create targeted diagnostics just for the remaining ids
                .map(copyDiagnosticAndChangeNode(diagnostic))
        );
    };

    const expandedDiagnostics = flatten(passMap(diagnostics, expandRemainingNoopWarnings));
    return expandedDiagnostics.length === diagnostics.length
        ? expandedDiagnostics
        : // This can generate duplicate diagnostics
          expandedDiagnostics.filter(dedupDiagnostics());
}

function dedupDiagnostics() {
    const hashDiagnostic = (diag: ts.Diagnostic) =>
        [diag.start, diag.length, diag.category, diag.source, diag.code]
            .map((x) => JSON.stringify(x))
            .join(':');

    const known = new Set();

    return (diag: ts.Diagnostic) => {
        const key = hashDiagnostic(diag);
        if (known.has(key)) {
            return false;
        } else {
            known.add(key);
            return true;
        }
    };
}

function get$$PropsAliasForInfo(
    get$$PropsDefWithCache: () => ReturnType<typeof get$$PropsDef>,
    lang: ts.LanguageService,
    document: Document
) {
    if (!/type\s+\$\$Props[\s\n]+=/.test(document.getText())) {
        return;
    }

    const propsDef = get$$PropsDefWithCache();
    if (!propsDef || !ts.isTypeAliasDeclaration(propsDef)) {
        return;
    }

    const type = lang.getProgram()?.getTypeChecker()?.getTypeAtLocation(propsDef.name);
    if (!type) {
        return;
    }

    // TS says symbol is always defined but it's not
    const rootSymbolName = (type.aliasSymbol ?? type.symbol)?.name;
    if (!rootSymbolName) {
        return;
    }

    return [rootSymbolName, propsDef] as const;
}

function get$$PropsDef(lang: ts.LanguageService, snapshot: SvelteDocumentSnapshot) {
    const program = lang.getProgram();
    const sourceFile = program?.getSourceFile(snapshot.filePath);
    if (!program || !sourceFile) {
        return undefined;
    }

    const renderFunction = sourceFile.statements.find(
        (statement): statement is ts.FunctionDeclaration =>
            ts.isFunctionDeclaration(statement) && statement.name?.getText() === 'render'
    );
    return renderFunction?.body?.statements.find(
        (node): node is ts.TypeAliasDeclaration | ts.InterfaceDeclaration =>
            (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) &&
            node.name.getText() === '$$Props'
    );
}

function movePropsErrorRangeBackIfNecessary(
    diagnostic: Diagnostic,
    snapshot: SvelteDocumentSnapshot,
    get$$PropsDefWithCache: () => ReturnType<typeof get$$PropsDef>,
    get$$PropsAliasForWithCache: () => ReturnType<typeof get$$PropsAliasForInfo>
): Range | undefined {
    const possibly$$PropsError = isAfterSvelte2TsxPropsReturn(
        snapshot.getFullText(),
        snapshot.offsetAt(diagnostic.range.start)
    );
    if (!possibly$$PropsError) {
        return;
    }

    if (diagnostic.message.includes('$$Props')) {
        const propsDef = get$$PropsDefWithCache();
        const generatedPropsStart = propsDef?.name.getStart();
        const propsStart =
            generatedPropsStart != null &&
            snapshot.getOriginalPosition(snapshot.positionAt(generatedPropsStart));

        if (propsStart) {
            return {
                start: propsStart,
                end: { ...propsStart, character: propsStart.character + '$$Props'.length }
            };
        }

        return;
    }

    const aliasForInfo = get$$PropsAliasForWithCache();
    if (!aliasForInfo) {
        return;
    }

    const [aliasFor, propsDef] = aliasForInfo;
    if (diagnostic.message.includes(aliasFor)) {
        return mapRangeToOriginal(snapshot, {
            start: snapshot.positionAt(propsDef.name.getStart()),
            end: snapshot.positionAt(propsDef.name.getEnd())
        });
    }
}

function expectedTransitionThirdArgument(
    diagnostic: ts.Diagnostic,
    tsDoc: SvelteDocumentSnapshot,
    lang: ts.LanguageService
) {
    if (
        diagnostic.code !== DiagnosticCode.EXPECTED_N_ARGUMENTS ||
        !diagnostic.start ||
        !tsDoc.getText(0, diagnostic.start).endsWith('__sveltets_2_ensureTransition(')
    ) {
        return false;
    }

    const node = findDiagnosticNode(diagnostic);
    if (!node) {
        return false;
    }

    // in TypeScript 5.4 the error is on the function name
    // in earlier versions it's on the whole call expression
    const callExpression =
        ts.isIdentifier(node) && ts.isCallExpression(node.parent)
            ? node.parent
            : findNodeAtSpan(
                  node,
                  { start: node.getStart(), length: node.getWidth() },
                  ts.isCallExpression
              );

    const signature =
        callExpression && lang.getProgram()?.getTypeChecker().getResolvedSignature(callExpression);

    return (
        signature?.parameters.filter((parameter) => !(parameter.flags & ts.SymbolFlags.Optional))
            .length === 3
    );
}
