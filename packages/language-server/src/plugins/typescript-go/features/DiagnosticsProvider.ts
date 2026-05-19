import type { FileSystem } from '@typescript/native-preview/unstable/fs' with { 'resolution-mode': 'import' };
import fs from 'node:fs';
import { dirname } from 'node:path';
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
import { getPackageInfo, importSvelte } from '../../../importPackage';
import {
    Document,
    getLineOffsets,
    getNodeIfIsInStartTag,
    getTextInRange,
    isRangeInTag,
    mapRangeToOriginal,
    positionAt
} from '../../../lib/documents';
import { FileMap } from '../../../lib/documents/fileCollection';
import { Logger } from '../../../logger';
import {
    clamp,
    memoize,
    normalizePath,
    passMap,
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
import {
    gatherIdentifiers,
    getStartOfNode,
    isInReactiveStatement,
    isReactiveStatement
} from './utils';

const VIRTUAL_SUFFIX = '_virtual__';
const svelteExtLength = '.svelte'.length;

const UTF8_RUNE_SELF = 0x80;
const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

export class SvelteCheckTSGoDiagnosticsProvider implements DiagnosticsProvider {
    private readonly api: tsApiSync.API;
    private readonly tsApiModule: typeof tsApiSync;
    private readonly files: FileMap<DocumentSnapshot> = new FileMap();
    private readonly virtualFiles: FileMap<string> = new FileMap();
    private readonly tsAstModule: typeof tsAst;
    private readonly virtualTsconfigPath: string;
    private readonly ambientTypesSource: string;
    private readonly snapshotOptions: SvelteSnapshotOptions;
    private readonly tsconfigPath: string;

    private createDocument: (filePath: string, content: string) => Document;

    constructor(
        apiModule: typeof tsApiSync,
        tsAstModule: typeof tsAst,
        tsconfigPath: string,
        ambientTypesSource: string,
        createDocument: (filePath: string, content: string) => Document
    ) {
        this.tsApiModule = apiModule;
        this.tsAstModule = tsAstModule;
        this.tsconfigPath = tsconfigPath;
        this.virtualTsconfigPath = path.join(
            path.dirname(tsconfigPath),
            `tsconfig${VIRTUAL_SUFFIX}.json`
        );
        this.createDocument = createDocument;
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

        const virtualPath = toVirtualPath(tsDoc);
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

        return mapAndFilterDiagnostics(
            this.tsAstModule,
            this.tsApiModule,
            project,
            diagnostics,
            document,
            tsDoc
        );
    }

    getProject() {
        const snapshot = this.api.updateSnapshot({
            openProject: this.virtualTsconfigPath
        });
        const project = snapshot.getProject(this.virtualTsconfigPath);
        return project;
    }

    mapAndFilterDiagnostics(
        project: tsApiSync.Project,
        diagnostics: tsApiSync.Diagnostic[]
    ): { filePath: string; text: string; diagnostics: Diagnostic[] }[] {
        const byFile = new Map<string, tsApiSync.Diagnostic[]>();
        for (const diag of diagnostics) {
            let bucket = byFile.get(diag.fileName ?? this.tsconfigPath);
            if (!bucket) {
                bucket = [];
            }
            bucket.push(diag);
        }

        const result: { filePath: string; diagnostics: Diagnostic[]; text: string }[] = [];
        for (const [fileName, diags] of byFile) {
            const tsDoc = this.files.get(normalizePath(fileName));
            if (!tsDoc) {
                result.push(this.covertDiagnosticsForUnopenedFile(fileName, diags));
                continue;
            }

            if (tsDoc instanceof SvelteDocumentSnapshot) {
                const mappedDiags = mapAndFilterDiagnostics(
                    this.tsAstModule,
                    this.tsApiModule,
                    project,
                    diags,
                    tsDoc.parent,
                    tsDoc
                );
                result.push({
                    filePath: fileName,
                    text: tsDoc.parent.getText(),
                    diagnostics: mappedDiags
                });
            }

            // TODO SvelteKit route files
        }

        return result;
    }

    async getDiagnosticsForPullMode(document: Document): Promise<DocumentDiagnosticReport> {
        return {
            items: await this.getDiagnostics(document),
            kind: 'full'
        };
    }

    private createFsProxy(): Required<
        Pick<FileSystem, 'readFile' | 'fileExists' | 'getAccessibleEntries'>
    > {
        const service = this;
        const kitFiles: Parameters<typeof internalHelpers.isKitFile>[1] = {
            serverHooksPath: 'src/hooks.client',
            clientHooksPath: 'src/hooks.client',
            universalHooksPath: 'src/hooks',
            paramsPath: 'src/params'
        };

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
                const normalizedPath = normalizePath(path);
                const virtualEntry = service.virtualFiles.get(normalizedPath);
                if (virtualEntry !== undefined) {
                    return virtualEntry;
                }

                if (normalizedPath.endsWith('node_modules/svelte/types/ambient.d.ts')) {
                    return '';
                }

                if (
                    normalizedPath.endsWith('node_modules/svelte/types/index.d.ts') ||
                    internalHelpers.isKitFile(normalizedPath, kitFiles)
                ) {
                    const snapshot = DocumentSnapshot.fromFilePath(
                        normalizedPath,
                        service.createDocument,
                        service.snapshotOptions,
                        ts.sys
                    );
                    service.files.set(normalizedPath, snapshot);
                    return snapshot.getFullText();
                }

                // undefined to signal api to read from disk by itself
                return undefined;
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

                // undefined to signal api to check existence by itself
                return undefined;
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
        const virtualPath = toVirtualPath(svelteFile);
        this.virtualFiles.set(virtualPath, svelteFile.getFullText());
        const dtsBasename = path.basename(dtsPath);
        const virtualBasename = path.basename(virtualPath);

        const dtsImportPath = `./${virtualBasename}`;
        const dtsContent = `export { default } from "${dtsImportPath}";\nexport * from "${dtsImportPath}";\n`;
        this.virtualFiles.set(dtsPath, dtsContent);

        return [dtsBasename, virtualBasename];
    }

    private covertDiagnosticsForUnopenedFile(
        filePath: string,
        diagnostics: tsApiSync.Diagnostic[]
    ): { filePath: string; diagnostics: Diagnostic[]; text: string } {
        const text = ts.sys.readFile(filePath) ?? '';
        const result: Diagnostic[] = [];
        const lineOffsets = getLineOffsets(text);
        const utf8Info = getUtf8LineOffsets(text);
        for (const diag of diagnostics) {
            const startOffset = toUtf16Pos(utf8Info, diag.pos, lineOffsets);
            const endOffset = toUtf16Pos(utf8Info, diag.end, lineOffsets);

            result.push({
                range: {
                    start: positionAt(startOffset, text, lineOffsets),
                    end: positionAt(endOffset, text, lineOffsets)
                },
                severity: mapSeverity(diag.category),
                message: flattenDiagnosticMessage(diag),
                code: diag.code,
                source: diag.fileName?.endsWith('js') ? 'js' : 'ts',
                tags: getDiagnosticTag(diag)
            });
        }
        return { filePath, diagnostics: result, text };
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

function toVirtualPath(snapshot: DocumentSnapshot) {
    const ext = snapshot.scriptKind === ts.ScriptKind.TS ? '.ts' : '.js';
    return normalizePath(snapshot.filePath.slice(0, -svelteExtLength) + VIRTUAL_SUFFIX + ext);
}

export function mapAndFilterDiagnostics(
    tsAstModule: typeof tsAst,
    tsApiModule: typeof tsApiSync,
    tsApiProject: tsApiSync.Project,
    diagnostics: tsApiSync.Diagnostic[],
    document: Document,
    tsDoc: SvelteDocumentSnapshot
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

    diagnostics = resolveNoopsInReactiveStatements(tsAstModule, tsApiProject, diagnostics);

    const source =
        tsDoc.scriptKind === ts.ScriptKind.TSX || tsDoc.scriptKind === ts.ScriptKind.TS
            ? 'ts'
            : 'js';
    const mapRange = rangeMapper(tsAstModule, tsApiModule, tsApiProject, tsDoc, document);
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

function flattenDiagnosticMessage(diag: tsApiSync.Diagnostic, level = 0): string {
    if (!diag.messageChain) {
        return diag.text;
    }

    let messages = [diag.text];
    for (let i = 0; i < diag.messageChain.length; i++) {
        const chainedDiag = diag.messageChain[i];
        const indent = '  '.repeat(level + 1);
        messages.push(indent + flattenDiagnosticMessage(chainedDiag, level + 1));
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
    tsApiModule: typeof tsApiSync,
    project: tsApiSync.Project,
    snapshot: SvelteDocumentSnapshot,
    document: Document
): (value: Diagnostic) => Diagnostic {
    const get$$PropsDefWithCache = memoize(() => get$$PropsDef(tsAstModule, project, snapshot));
    const get$$PropsAliasInfoWithCache = memoize(() =>
        get$$PropsAliasForInfo(tsAstModule, tsApiModule, project, get$$PropsDefWithCache, document)
    );

    return (diagnostic) => {
        let range = mapRangeToOriginal(snapshot, diagnostic.range);
        if (range.start.line < 0) {
            range =
                movePropsErrorRangeBackIfNecessary(
                    tsAstModule,
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

function findDiagnosticNode(
    tsAstModule: typeof tsAst,
    diagnostic: tsApiSync.Diagnostic,
    sourceFile: tsAst.SourceFile
) {
    const touchingNode = tsAstModule.getTouchingToken(sourceFile, diagnostic.pos);
    if (touchingNode.end === diagnostic.end) {
        return touchingNode;
    }
    let current: tsAst.Node | undefined = touchingNode.parent;
    while (current.pos === touchingNode.pos) {
        if (current.end === diagnostic.end) {
            return current;
        }
        current = current.parent;
    }
}

function copyDiagnosticAndChangeNode(
    tsAstModule: typeof tsAst,
    diagnostic: tsApiSync.Diagnostic,
    sourceFile: tsAst.SourceFile
) {
    return (node: tsAst.Node): tsApiSync.Diagnostic => {
        const start = getStartOfNode(tsAstModule, node, sourceFile);
        return {
            ...diagnostic,
            pos: start,
            end: node.end
        };
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
    const diagNode = findDiagnosticNode(tsApiModule, diagnostic, sourceFile);
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
function resolveNoopsInReactiveStatements(
    tsAstModule: typeof tsAst,
    project: tsApiSync.Project,
    diagnostics: tsApiSync.Diagnostic[]
) {
    const notLet = (node: tsAst.Node) => {
        const declaration = project.checker.getSymbolAtLocation(node)?.valueDeclaration;
        if (!declaration || declaration.kind !== tsAstModule.SyntaxKind.VariableDeclaration) {
            return true;
        }

        const declarationNode = declaration.resolve(project);
        if (!declarationNode || !tsAstModule.isVariableDeclarationList(declarationNode.parent)) {
            return true;
        }
        return (declarationNode.parent.flags & tsAstModule.NodeFlags.Let) === 0;
    };

    const expandRemainingNoopWarnings = (
        diagnostic: tsApiSync.Diagnostic
    ): void | tsApiSync.Diagnostic[] => {
        const { code, fileName } = diagnostic;

        // guard: not target error
        const isNoopDiag = code === DiagnosticCode.NOOP_IN_COMMAS;
        if (!isNoopDiag) {
            return;
        }

        const sourceFile = fileName && project.program.getSourceFile(fileName);
        if (!sourceFile) {
            return;
        }
        const diagNode = findDiagnosticNode(tsAstModule, diagnostic, sourceFile);
        if (!diagNode) {
            return;
        }

        if (!isInReactiveStatement(tsAstModule, diagNode)) {
            return;
        }

        const copyWorker = copyDiagnosticAndChangeNode(tsAstModule, diagnostic, sourceFile);
        return (
            // for all identifiers in diagnostic node
            gatherIdentifiers(tsAstModule, diagNode)
                // ignore `let` (i.e. reactive) variables
                .filter(notLet)
                // and create targeted diagnostics just for the remaining ids
                .map(copyWorker)
        );
    };

    const expandedDiagnostics = passMap(diagnostics, expandRemainingNoopWarnings).flat();
    return expandedDiagnostics.length === diagnostics.length
        ? expandedDiagnostics
        : // This can generate duplicate diagnostics
          expandedDiagnostics.filter(dedupDiagnostics());
}

function dedupDiagnostics() {
    const hashDiagnostic = (diag: tsApiSync.Diagnostic) =>
        [diag.pos, diag.end, diag.category, diag.fileName, diag.code]
            .map((x) => JSON.stringify(x))
            .join(':');

    const known = new Set();

    return (diag: tsApiSync.Diagnostic) => {
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
    tsAstModule: typeof tsAst,
    tsApiModule: typeof tsApiSync,
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
    const rootSymbol = type.getSymbol();
    if (!rootSymbol) {
        return;
    }
    if (rootSymbol.flags & tsApiModule.SymbolFlags.TypeLiteral) {
        const node = rootSymbol.declarations?.[0]?.resolve(project);
        if (!node || !tsAstModule.isTypeAliasDeclaration(node.parent) || !node.parent.name) {
            return;
        }
        return [node.parent.name.text, propsDef] as const;
    }
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
    const sourceFile = program.getSourceFile(toVirtualPath(snapshot));
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
        const generatedPropsStart = getStartOfNode(
            tsAstModule,
            propsDef.name,
            propsDef.getSourceFile()
        );
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
                getStartOfNode(tsAstModule, propsDef.name, propsDef.getSourceFile())
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
    const node = findDiagnosticNode(tsAstModule, diagnostic, sourceFile);
    if (!node || !tsAstModule.isIdentifier(node)) {
        return false;
    }
    if (!node.parent || !tsAstModule.isCallExpression(node.parent)) {
        return false;
    }
    const callExpression = node.parent;
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
