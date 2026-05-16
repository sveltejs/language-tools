import type { FileSystem } from '@typescript/native-preview/fs' with { 'resolution-mode': 'import' };
import fs from 'node:fs';
import path from 'path';
import { internalHelpers } from 'svelte2tsx';
import ts from 'typescript';
import {
    CancellationToken,
    Diagnostic,
    DiagnosticSeverity,
    DiagnosticTag,
    DocumentDiagnosticReport,
    Range
} from 'vscode-languageserver';
import {
    Document,
    getLineOffsets,
    getNodeIfIsInStartTag,
    getTextInRange,
    isRangeInTag,
    mapRangeToOriginal
} from '../../../lib/documents';
import { FileMap } from '../../../lib/documents/fileCollection';
import {
    clamp,
    memoize,
    normalizePath,
    pathToUrl,
    swapRangeStartEndIfNecessary
} from '../../../utils';
import { DiagnosticsProvider } from '../../interfaces';
import {
    DocumentSnapshot,
    SvelteDocumentSnapshot,
    SvelteSnapshotOptions
} from '../../typescript/DocumentSnapshot';
import { DiagnosticCode } from '../../typescript/features/DiagnosticsProvider';
import { isAfterSvelte2TsxPropsReturn, isInGeneratedCode } from '../../typescript/features/utils';
import { isAttributeName, isEventHandler } from '../../typescript/svelte-ast-utils';
import { hasNonZeroRange, mapSeverity } from '../../typescript/utils';
import { tsApiSync, tsAst } from '../types';
import { getStartOfNode, isReactiveStatement } from './utils';
import { getPackageInfo, importSvelte } from '../../../importPackage';
import { dirname } from 'node:path';
import { Logger } from '../../../logger';

const VIRTUAL_SUFFIX = '_virtual__';
const svelteExtLength = '.svelte'.length;

const UTF8_RUNE_SELF = 0x80;
const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

export class SvelteCheckTSGoDiagnosticsProvider implements DiagnosticsProvider {
    private readonly api: tsApiSync.API;
    private readonly files: FileMap<DocumentSnapshot> = new FileMap();
    private readonly virtualFiles: FileMap<string> = new FileMap();
    private readonly tsAstModule: typeof tsAst;
    private readonly virtualTsconfigPath: string;
    private readonly ambientTypesSource: string;
    private readonly snapshotOptions: SvelteSnapshotOptions;

    constructor(
        apiModule: typeof tsApiSync,
        tsAstModule: typeof tsAst,
        tsconfigPath: string,
        ambientTypesSource: string
    ) {
        this.tsAstModule = tsAstModule;
        this.virtualTsconfigPath = path.join(
            path.dirname(tsconfigPath),
            `tsconfig${VIRTUAL_SUFFIX}.json`
        );
        this.ambientTypesSource = ambientTypesSource;
        const sveltePackage = importSvelte(tsconfigPath);
        this.snapshotOptions = {
            parse: sveltePackage.parse,
            transformOnTemplateError: false,
            typingsNamespace: 'svelteHTML',
            version: sveltePackage.VERSION
        };

        this.writeVirtualTsconfig(tsconfigPath);
        this.api = new apiModule.API({
            fs: this.createFsProxy()
        });
    }

    async getDiagnostics(
        document: Document,
        cancellationToken?: CancellationToken
    ): Promise<Diagnostic[]> {
        const filePath = document.getFilePath();
        if (!filePath) {
            return [];
        }
        const project = this.getProject();
        if (!project) {
            return [];
        }

        const tsDoc = this.files.get(normalizePath(filePath));

        if (!tsDoc || !(tsDoc instanceof SvelteDocumentSnapshot)) {
            return [];
        }

        if (
            ['coffee', 'coffeescript'].includes(document.getLanguageAttribute('script')) ||
            cancellationToken?.isCancellationRequested
        ) {
            return [];
        }

        // Document preprocessing failed, show parser error instead
        const parserErrorDiag = getParserErrorDiagnostic(tsDoc);
        if (parserErrorDiag) {
            return [parserErrorDiag];
        }

        const virtualPath = this.toVirtualPath(tsDoc);
        const diagnosticsWithUtf8Pos: tsApiSync.Diagnostic[] = [];
        const program = project.program;
        diagnosticsWithUtf8Pos.push(...(program.getSyntacticDiagnostics(virtualPath) || []));
        diagnosticsWithUtf8Pos.push(...(program.getSuggestionDiagnostics(virtualPath) || []));
        diagnosticsWithUtf8Pos.push(...(program.getSemanticDiagnostics(virtualPath) || []));

        // TODO: The sourceFile positions are already in UTF-16,
        // So it probably is a bug that typescript api returns diagnostics with UTF-8 positions
        const utf8Info = getUtf8LineOffsets(tsDoc.getFullText());
        const diagnostics: tsApiSync.Diagnostic[] = [];
        const lineOffsets = getLineOffsets(tsDoc.getFullText());
        for (const diag of diagnosticsWithUtf8Pos) {
            const startOffset = toUtf16Pos(utf8Info, diag.pos, lineOffsets);
            const endOffset = toUtf16Pos(utf8Info, diag.end, lineOffsets);
            diagnostics.push({ ...diag, pos: startOffset, end: endOffset });
        }

        return mapAndFilterDiagnostics(diagnostics, document, tsDoc, this.tsAstModule, project);
    }

    getProject() {
        const snapshot = this.api.updateSnapshot({
            openProject: this.virtualTsconfigPath
        });
        const project = snapshot.getProject(this.virtualTsconfigPath);
        return project;
    }

    async getDiagnosticsForPullMode(document: Document): Promise<DocumentDiagnosticReport> {
        return {
            items: await this.getDiagnostics(document),
            kind: 'full'
        };
    }

    private toVirtualPath(snapshot: DocumentSnapshot) {
        const ext = snapshot.scriptKind === ts.ScriptKind.TS ? '.ts' : '.js';
        return normalizePath(snapshot.filePath.slice(0, -svelteExtLength) + VIRTUAL_SUFFIX + ext);
    }

    private createFsProxy(): Required<
        Pick<FileSystem, 'readFile' | 'fileExists' | 'getAccessibleEntries'>
    > {
        const service = this;

        return {
            getAccessibleEntries(directory: string) {
                const files: string[] = [];
                const directories: string[] = [];
                try {
                    const entries = fs.readdirSync(directory, { withFileTypes: true });
                    for (const entry of entries) {
                        if (entry.isFile()) {
                            addFileEntry(path.join(directory, entry.name));
                        } else if (entry.isDirectory()) {
                            directories.push(entry.name);
                        } else if (entry.isSymbolicLink()) {
                            const fullPath = path.join(directory, entry.name);
                            const stats = fs.statSync(fullPath);
                            if (stats.isFile()) {
                                addFileEntry(fullPath);
                            } else if (stats.isDirectory()) {
                                directories.push(entry.name);
                            }
                        }
                    }

                    return {
                        files: files,
                        directories: directories
                    };
                } catch (error) {
                    Logger.error(`Error reading directory ${directory}:`, error);
                    return undefined;
                }

                function addFileEntry(fullPath: string) {
                    if (fullPath.endsWith('.svelte')) {
                        files.push(...service.addVirtualSvelteFile(fullPath));
                    } else {
                        files.push(path.basename(fullPath));
                    }
                }
            },
            readFile(path: string) {
                const virtualEntry = service.virtualFiles.get(normalizePath(path));
                if (virtualEntry !== undefined) {
                    return virtualEntry;
                }

                return ts.sys.readFile(path);
            },
            fileExists(path: string) {
                if (path.endsWith('.d.svelte.ts')) {
                    if (fs.existsSync(path) || service.virtualFiles.has(normalizePath(path))) {
                        return true;
                    }

                    const targetSvelteFile = path.slice(0, -'.d.svelte.ts'.length) + '.svelte';

                    if (fs.existsSync(targetSvelteFile)) {
                        service.addVirtualSvelteFile(targetSvelteFile);
                        return true;
                    }
                }

                return fs.existsSync(path);
            }
        };
    }

    private writeVirtualTsconfig(tsconfigPath: string) {
        const json = ts.parseConfigFileTextToJson(
            tsconfigPath,
            ts.sys.readFile(tsconfigPath) || ''
        );
        const sveltePackageInfo = getPackageInfo('svelte', this.virtualTsconfigPath);
        const tsconfigDir = path.dirname(this.virtualTsconfigPath);

        const svelteTsxFiles = internalHelpers.get_global_types(
            ts.sys,
            sveltePackageInfo.version.major === 3,
            sveltePackageInfo.path,
            dirname(require.resolve(this.ambientTypesSource, { paths: [tsconfigDir] })),
            undefined
        );
        const virtualTsConfigContent = JSON.stringify({
            extends: './' + path.basename(tsconfigPath),
            compilerOptions: { allowArbitraryExtensions: true },
            files: json.config.files ? [...json.config.files, ...svelteTsxFiles] : svelteTsxFiles,
            // otherwise only "files" will be included and not the default everything
            include: json.config.include ? undefined : ['**/*']
        });
        this.virtualFiles.set(normalizePath(this.virtualTsconfigPath), virtualTsConfigContent);
    }

    private addVirtualSvelteFile(filePath: string) {
        const svelteFile = DocumentSnapshot.fromFilePath(
            filePath,
            this.createDocument,
            this.snapshotOptions,
            ts.sys
        );
        const normalizedPath = normalizePath(filePath);
        this.files.set(normalizedPath, svelteFile);

        const dtsPath = normalizedPath.slice(0, -svelteExtLength) + '.d.svelte.ts';
        const virtualPath = this.toVirtualPath(svelteFile);
        this.virtualFiles.set(virtualPath, svelteFile.getFullText());
        const dtsBasename = path.basename(dtsPath);
        const virtualBasename = path.basename(virtualPath);

        const dtsImportPath = `./${virtualBasename}`;
        const dtsContent = `export { default } from "${dtsImportPath}";\nexport * from "${dtsImportPath}";\n`;
        this.virtualFiles.set(dtsPath, dtsContent);

        return [dtsBasename, virtualBasename];
    }

    private createDocument(filePath: string, content: string): Document {
        const document = new Document(pathToUrl(filePath), content);
        return document;
    }

    dispose() {
        this.api.close();
    }
}

function getParserErrorDiagnostic(tsDoc: SvelteDocumentSnapshot): Diagnostic | undefined {
    if (!tsDoc.parserError) {
        return;
    }

    return {
        range: tsDoc.parserError.range,
        severity: DiagnosticSeverity.Error,
        source:
            tsDoc.scriptKind === ts.ScriptKind.TSX || tsDoc.scriptKind === ts.ScriptKind.TS
                ? 'ts'
                : 'js',
        message: tsDoc.parserError.message,
        code: tsDoc.parserError.code
    };
}

export function mapAndFilterDiagnostics(
    diagnostics: tsApiSync.Diagnostic[],
    document: Document,
    tsDoc: SvelteDocumentSnapshot,
    tsAstModule: typeof tsAst,
    tsApiProject: tsApiSync.Project
): Diagnostic[] {
    // For svelte-check tsgo, we called api to get all diagnostics instead of calling getDiagnostics for each file separately. So we also need to check parser error or coffeescript files here.
    if (['coffee', 'coffeescript'].includes(document.getLanguageAttribute('script'))) {
        return [];
    }

    // Document preprocessing failed, show parser error instead
    const parserErrorDiag = getParserErrorDiagnostic(tsDoc);
    if (parserErrorDiag) {
        return [parserErrorDiag];
    }

    const notGenerated = isNotGenerated(tsDoc.getFullText());

    diagnostics = diagnostics
        .filter(notGenerated)
        .filter(
            (diagnostic) => !isUnusedReactiveStatementLabel(tsAstModule, tsApiProject, diagnostic)
        )
        .filter(
            (diagnostic) =>
                !expectedTransitionThirdArgument(tsAstModule, diagnostic, tsDoc, tsApiProject)
        );

    // diagnostics = resolveNoopsInReactiveStatements(lang, diagnostics);

    const source =
        tsDoc.scriptKind === ts.ScriptKind.TSX || tsDoc.scriptKind === ts.ScriptKind.TS
            ? 'ts'
            : 'js';
    const mapRange = rangeMapper(tsAstModule, tsApiProject, tsDoc, document);
    const noFalsePositive = isNoFalsePositive(document, tsDoc);
    const converted: Diagnostic[] = [];

    for (const tsDiag of diagnostics) {
        let diagnostic: Diagnostic = {
            range: { start: tsDoc.positionAt(tsDiag.pos), end: tsDoc.positionAt(tsDiag.end) },
            severity: mapSeverity(tsDiag.category),
            source,
            message: flattenDiagnosticMessage(tsDiag),
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

function flattenDiagnosticMessage(diag: tsApiSync.Diagnostic): string {
    if (!diag.messageChain) {
        return diag.text;
    }

    let messages = [diag.text];
    const indent = '  ';
    for (let i = 0; i < diag.messageChain.length; i++) {
        const chainedDiag = diag.messageChain[i];
        messages.push(`${indent.repeat(i + 1)}${chainedDiag.text}`);
    }
    return messages.join('\n');
}

function moveBindingErrorMessage(
    tsDiag: tsApiSync.Diagnostic,
    tsDoc: SvelteDocumentSnapshot,
    diagnostic: Diagnostic,
    document: Document
) {
    if (
        tsDiag.code === DiagnosticCode.TYPE_X_NOT_ASSIGNABLE_TO_TYPE_Y &&
        tsDiag.pos &&
        tsDoc.getText(tsDiag.pos, tsDiag.end).endsWith('.$$bindings')
    ) {
        let node = tsDoc.svelteNodeAt(diagnostic.range.start);
        while (node && node.type !== 'InlineComponent') {
            node = node.parent!;
        }
        if (node) {
            let name = tsDoc.getText(tsDiag.end, tsDiag.end + 100);
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
    tsAstModule: typeof tsAst,
    project: tsApiSync.Project,
    snapshot: SvelteDocumentSnapshot,
    document: Document
): (value: Diagnostic) => Diagnostic {
    const get$$PropsDefWithCache = memoize(() => get$$PropsDef(tsAstModule, project, snapshot));
    const get$$PropsAliasInfoWithCache = memoize(() =>
        get$$PropsAliasForInfo(tsAstModule, project, get$$PropsDefWithCache, document)
    );

    return (diagnostic) => {
        let range = mapRangeToOriginal(snapshot, diagnostic.range);
        if (range.start.line < 0) {
            range =
                movePropsErrorRangeBackIfNecessary(
                    tsAstModule,
                    project,
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
    return (diagnostic: tsApiSync.Diagnostic) => {
        return !isInGeneratedCode(text, diagnostic.pos, diagnostic.end);
    };
}

function isUnusedReactiveStatementLabel(
    tsApiModule: typeof tsAst,
    project: tsApiSync.Project,
    diagnostic: tsApiSync.Diagnostic
) {
    if (diagnostic.code !== DiagnosticCode.UNUSED_LABEL) {
        return false;
    }

    const sourceFile = diagnostic.fileName && project.program.getSourceFile(diagnostic.fileName);
    if (!sourceFile) {
        return false;
    }
    const diagNode = tsApiModule.getTouchingToken(sourceFile, diagnostic.pos);
    if (!diagNode) {
        return false;
    }

    // TS warning targets the identifier
    if (!tsApiModule.isIdentifier(diagNode)) {
        return false;
    }

    if (!diagNode.parent) {
        return false;
    }
    return isReactiveStatement(tsApiModule, diagNode.parent);
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
// function resolveNoopsInReactiveStatements(
//     project: tsApiSync.Project,
//     diagnostics: tsApiSync.Diagnostic[]
// ) {
//     const isLet = (file: tsAst.SourceFile) => (node: tsAst.Node) => {
//         project.checker.getSymbolAtLocation(node)?.valueDeclaration?.kind;

//         const defs = lang.getDefinitionAtPosition(file.fileName, node.getStart());
//         return !!defs && defs.some((def) => def.fileName === file.fileName && def.kind === 'let');
//     };

//     const expandRemainingNoopWarnings = (
//         diagnostic: tsApiSync.Diagnostic
//     ): void | tsApiSync.Diagnostic[] => {
//         const { code, file } = diagnostic;

//         // guard: not target error
//         const isNoopDiag = code === DiagnosticCode.NOOP_IN_COMMAS;
//         if (!isNoopDiag) {
//             return;
//         }

//         const diagNode = findDiagnosticNode(diagnostic);
//         if (!diagNode) {
//             return;
//         }

//         if (!isInReactiveStatement(diagNode)) {
//             return;
//         }

//         return (
//             // for all identifiers in diagnostic node
//             gatherIdentifiers(diagNode)
//                 // ignore `let` (i.e. reactive) variables
//                 .filter(not(isLet(file)))
//                 // and create targeted diagnostics just for the remaining ids
//                 .map(copyDiagnosticAndChangeNode(diagnostic))
//         );
//     };

//     const expandedDiagnostics = passMap(diagnostics, expandRemainingNoopWarnings).flat();
//     return expandedDiagnostics.length === diagnostics.length
//         ? expandedDiagnostics
//         : // This can generate duplicate diagnostics
//           expandedDiagnostics.filter(dedupDiagnostics());
// }

function get$$PropsAliasForInfo(
    tsAstModule: typeof tsAst,
    project: tsApiSync.Project,
    get$$PropsDefWithCache: () => ReturnType<typeof get$$PropsDef>,
    document: Document
) {
    if (!/type\s+\$\$Props[\s\n]+=/.test(document.getText())) {
        return;
    }

    const propsDef = get$$PropsDefWithCache();
    if (!propsDef || !tsAstModule.isTypeAliasDeclaration(propsDef)) {
        return;
    }

    const type = project.checker.getTypeAtLocation(propsDef.name);
    if (!type) {
        return;
    }

    // TS says symbol is always defined but it's not
    // TODO no API for getting the aliased symbol?
    // const rootSymbolName = (type.aliasSymbol ?? type.symbol)?.name;
    const rootSymbolName = type.getSymbol()?.name;
    if (!rootSymbolName) {
        return;
    }

    return [rootSymbolName, propsDef] as const;
}

function get$$PropsDef(
    tsAstModule: typeof tsAst,
    project: tsApiSync.Project,
    snapshot: SvelteDocumentSnapshot
) {
    const program = project.program;
    const sourceFile = program.getSourceFile(snapshot.filePath);
    if (!program || !sourceFile) {
        return undefined;
    }

    const renderFunction = sourceFile.statements.find(
        (statement): statement is tsAst.FunctionDeclaration =>
            tsAstModule.isFunctionDeclaration(statement) &&
            statement.name?.text === internalHelpers.renderName
    );
    return renderFunction?.body?.statements.find(
        (node): node is tsAst.TypeAliasDeclaration | tsAst.InterfaceDeclaration =>
            (tsAstModule.isTypeAliasDeclaration(node) ||
                tsAstModule.isInterfaceDeclaration(node)) &&
            node.name.text === '$$Props'
    );
}

function movePropsErrorRangeBackIfNecessary(
    tsAstModule: typeof tsAst,
    project: tsApiSync.Project,
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
        if (!propsDef) {
            return;
        }
        const generatedPropsStart = getStartOfNode(tsAstModule, propsDef, propsDef.getSourceFile());
        const propsStart = snapshot.getOriginalPosition(snapshot.positionAt(generatedPropsStart));

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
            start: snapshot.positionAt(
                getStartOfNode(tsAstModule, propsDef, propsDef.getSourceFile())
            ),
            end: snapshot.positionAt(propsDef.name.end)
        });
    }
}

function expectedTransitionThirdArgument(
    tsAstModule: typeof tsAst,
    diagnostic: tsApiSync.Diagnostic,
    tsDoc: SvelteDocumentSnapshot,
    project: tsApiSync.Project
) {
    if (
        diagnostic.code !== DiagnosticCode.EXPECTED_N_ARGUMENTS ||
        !tsDoc.getText(0, diagnostic.pos).endsWith('__sveltets_2_ensureTransition(')
    ) {
        return false;
    }

    const sourceFile = diagnostic.fileName && project.program.getSourceFile(diagnostic.fileName);
    if (!sourceFile) {
        return false;
    }
    const node = tsAstModule.getTouchingToken(sourceFile, diagnostic.pos);
    if (!node) {
        return false;
    }

    // in TypeScript 5.4 the error is on the function name
    // in earlier versions it's on the whole call expression
    const callExpression =
        tsAstModule.isIdentifier(node) && tsAstModule.isCallExpression(node.parent)
            ? node.parent
            : tsAstModule.getTouchingToken(sourceFile, diagnostic.pos);
    const signature = callExpression && project.checker.getResolvedSignature(callExpression);

    return (
        signature?.parameters.filter((parameter) => !(parameter.flags & ts.SymbolFlags.Optional))
            .length === 3
    );
}
function getDiagnosticTag(tsDiag: tsApiSync.Diagnostic): DiagnosticTag[] | undefined {
    const tags: DiagnosticTag[] = [];
    if (tsDiag.reportsUnnecessary) {
        tags.push(DiagnosticTag.Unnecessary);
    }
    if (tsDiag.reportsDeprecated) {
        tags.push(DiagnosticTag.Deprecated);
    }
    return tags;
}

type Utf8LineOffsetInfo =
    | { isAsciiOnly: true }
    | {
          isAsciiOnly: false;
          lineOffsets: number[];
          bytes: Uint8Array;
      };

function getUtf8LineOffsets(text: string): Utf8LineOffsetInfo {
    let asciiOnly = true;
    for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i);
        if (charCode >= UTF8_RUNE_SELF) {
            asciiOnly = false;
            break;
        }
    }

    if (asciiOnly) {
        return {
            isAsciiOnly: true
        };
    }

    const lineOffsets: number[] = [0];
    const utf8Bytes = textEncoder.encode(text);
    for (let i = 0; i < utf8Bytes.length; i++) {
        if (utf8Bytes[i] === 13 /* \r */) {
            i++;
            if (utf8Bytes[i] === 10 /* \n */) {
                lineOffsets.push(i + 1);
            } else {
                lineOffsets.push(i);
            }
        }
        if (utf8Bytes[i] === 10 /* \n */) {
            lineOffsets.push(i + 1);
        }
    }

    return {
        isAsciiOnly: false,
        lineOffsets,
        bytes: utf8Bytes
    };
}

function toUtf16Pos(info: Utf8LineOffsetInfo, offset: number, utf16LineOffsets: number[]): number {
    if (info.isAsciiOnly) {
        return offset;
    }

    offset = clamp(offset, 0, info.bytes.length);
    const lineOffsets = info.lineOffsets;

    let low = 0;
    let high = lineOffsets.length;
    if (high === 0) {
        return offset;
    }

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const lineOffset = lineOffsets[mid];

        if (lineOffset === offset) {
            return utf16LineOffsets[mid];
        } else if (offset > lineOffset) {
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    // low is the least x for which the line offset is larger than the current offset
    // or array.length if no line offset is larger than the current offset
    const line = low - 1;
    const lineText = textDecoder.decode(info.bytes.subarray(lineOffsets[line], offset));
    return utf16LineOffsets[line] + lineText.length;
}
