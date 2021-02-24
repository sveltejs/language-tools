import type ts from 'typescript/lib/tsserverlibrary';
import { LanguageFileMapper, TransformedLanguageFile, TSPluginContext } from '.';
import { debug } from './debug';
import { SourceMapConsumer } from './sourcemaps';
import { LineChar, tsInternalServerHelpers } from './types';
import {
	addSideEffects,
	extensionFromFileName,
	getExtensionFromScriptKind,
	getText,
	override,
	quote,
	toLineChar,
	toLineOffset,
	toPosition
} from './utils';

interface LanguageConfig {
    extension: string;
    scriptKind: ts.ScriptKind;
    extensionKind: ts.Extension;
    disabled?: (keyof ts.LanguageService)[];
    is(fileName: string): boolean;
    transform: (fileName: string, text: string) => LanguageFileMapper | TransformedLanguageFile;
    enableDebug?(context: TSPluginContext, debug_: typeof debug): void;
}
interface TextStorageMapper {
    getOriginalPosition(position: LineChar): LineChar;
    getGeneratedPosition(position: LineChar): LineChar;
    setOriginalText(text: string): void;
    originalLineStarts: number[];
    generatedLineStarts: number[];
    originalText: string;
    generatedText: string;
}
interface ScriptVersionCacheEventListener {
    create(): void;
    delete(): void;
    update(): void;
}
const voidPosition = (): LineChar => ({ line: -1, character: -1 });
const tsInternals = new (class {
    private addCacheEventListener(
        textStorage: tsInternalServerHelpers.TextStorage,
        host: ScriptVersionCacheEventListener
    ) {
        let svc = textStorage.svc;
        if (svc) host.create();
        addSideEffects(textStorage, {
            useText() {
                svc = undefined;
                host.delete();
            },
            switchToScriptVersionCache(current_svc) {
                if (svc === current_svc) return;
                else svc = current_svc;
                host.create();
                addSideEffects(svc, {
                    _getSnapshot: (r) => {
                        const a = getText(r);
                        host.update();
                    }
                });
            }
        });
    }
    private scriptInfoToMapper = new WeakMap<ts.server.ScriptInfo, TextStorageMapper>();
    private getMapper(
        context: TSPluginContext,
        lang: LanguageConfig,
        scriptInfo: ts.server.ScriptInfo
    ): TextStorageMapper {
        if (!this.scriptInfoToMapper.has(scriptInfo)) {
            this.scriptInfoToMapper.set(scriptInfo, {
                originalText: '',
                generatedText: '',
                originalLineStarts: [0],
                generatedLineStarts: [0],
                setOriginalText(text) {
                    if ('' === this.originalText && '' === text) return; // init blank calls
                    const { ts } = context;
                    const host = lang.transform(scriptInfo.fileName, text);
                    if ('mappings' in host) {
                        const mapper = new SourceMapConsumer(host.mappings);
                        this.generatedText = host.content;
                        this.getOriginalPosition = mapper.getOriginalPosition.bind(mapper);
                        this.getGeneratedPosition = mapper.getGeneratedPosition.bind(mapper);
                    } else {
                        this.generatedText = host.generatedText;
                        this.getOriginalPosition = host.getOriginalPosition.bind(host);
                        this.getGeneratedPosition = host.getGeneratedPosition.bind(host);
                    }
                    this.originalText = text;
                    this.originalLineStarts =
                        (host as any).originalLineStarts ?? ts.computeLineStarts(this.originalText);
                    this.generatedLineStarts =
                        (host as any).generatedlineStarts ??
                        ts.computeLineStarts(this.generatedText);
                },
                getOriginalPosition: voidPosition,
                getGeneratedPosition: voidPosition
            });
        }
        return this.scriptInfoToMapper.get(scriptInfo);
    }
    private rewriteFileContent(
        context: TSPluginContext,
        lang: LanguageConfig,
        scriptInfo: ts.server.ScriptInfo
    ) {
        const host = this.getMapper(context, lang, scriptInfo);
        const textStorage = this.getTextStorage(scriptInfo);
        const { ScriptVersionCache } = context.ts.server;
        const { ts } = context;
        let original_text_svc: tsInternalServerHelpers.ScriptVersionCache;
        override(textStorage, {
            reload(_, text) {
                host.setOriginalText(text);
                return _(host.generatedText);
            },
            edit(_, start, end, newText) {
                const s = host.getOriginalPosition(
                    ts.computeLineAndCharacterOfPosition(host.generatedLineStarts, start)
                );
                const e = host.getOriginalPosition(
                    ts.computeLineAndCharacterOfPosition(host.generatedLineStarts, end - 1)
                );
                const start2 = host.originalLineStarts[s.line] + s.character;
                const end2 = host.originalLineStarts[e.line] + e.character + 1;
                _(start, end, newText);
                original_text_svc.edit(start2, end2 - start2, newText);
            }
        });
        this.addCacheEventListener(textStorage, {
            create() {
                const text = host.originalText;
                original_text_svc = ScriptVersionCache.fromString(text);
            },
            delete() {
                original_text_svc = undefined;
            },
            update() {
                const snapshot = original_text_svc._getSnapshot();
                const text = getText(snapshot);
                debug.logFileContent(
                    this,
                    `Updated the cached version of the original file "${debug.projectPath(
                        scriptInfo.fileName
                    )}"`,
                    extensionFromFileName(scriptInfo.fileName),
                    text
                );
                host.setOriginalText(text);
            }
        });
        if (textStorage.text || textStorage.svc) {
            textStorage.reload(getText(textStorage.getSnapshot()));
        }
    }
    private isRangeEndState(host: TextStorageMapper) {
        let probablyRangeEnd = false;
        let prev = -1;
        return (position: number) => {
            if (-1 === prev) {
                queueMicrotask(() => {
                    if (probablyRangeEnd) {
                        debug.log(`Info: Previous task did not map a range`);
                        probablyRangeEnd = false;
                    }
                    prev = -1;
                });
            } else if (probablyRangeEnd) {
                if (position < prev) {
                    probablyRangeEnd = false;
                    debug.log(`RangeEnd false positive`);
                } else {
                }
            }
            prev = position;
            return !(probablyRangeEnd = !probablyRangeEnd);
        };
    }
    private rewriteFileMapping(
        context: TSPluginContext,
        lang: LanguageConfig,
        scriptInfo: ts.server.ScriptInfo
    ) {
        const host = this.getMapper(context, lang, scriptInfo);
        const textStorage = this.getTextStorage(scriptInfo);
        const getIsRangeEnd1 = this.isRangeEndState(host);
        const getIsRangeEnd2 = this.isRangeEndState(host);
        override(textStorage, {
            // original -> generated
            lineOffsetToPosition(_, lineOffset_line, lineOffset_offset) {
                const position_in_original = toLineChar({
                    line: lineOffset_line,
                    offset: lineOffset_offset
                });
                const { originalLineStarts, generatedLineStarts } = host;
                const original = toPosition(originalLineStarts, position_in_original);
                const isRangeEnd = getIsRangeEnd1(original);
                if (isRangeEnd && position_in_original.character !== 0) {
                    const position_in_generated = host.getGeneratedPosition({
                        line: position_in_original.line,
                        character: position_in_original.character - 1
                    });
                    const generated = toPosition(generatedLineStarts, position_in_generated) + 1;
                    debug.log(`Patched Range end (mapped as ${lineOffset_offset - 1} +1)`);
                    return generated;
                } else {
                    const position_in_generated = host.getGeneratedPosition(position_in_original);
                    const generated = toPosition(generatedLineStarts, position_in_generated);
                    return generated;
                }
            },
            // generated -> original
            positionToLineOffset(_, generated) {
                const isRangeEnd = getIsRangeEnd2(generated);
                if (isRangeEnd && generated !== 0) {
                    const position_in_generated = toLineChar(_(generated - 1));
                    const { line, character } = host.getOriginalPosition(position_in_generated);
                    debug.log(`Patched Range end (mapped as ${generated - 1} +1)`);
                    return toLineOffset({ line, character: character + 1 });
                } else {
                    const position_in_generated = toLineChar(_(generated));
                    const position_in_original = host.getOriginalPosition(position_in_generated);
                    return toLineOffset(position_in_original);
                }
            },
            // generated
            lineToTextSpan(_, line) {
                const lineStarts = host.generatedLineStarts;
                const start = lineStarts[line];
                const end = lineStarts[line + 1] ?? host.generatedText.length;
                return { start, length: end - start };
            }
        });
    }
    private debugAssertMappings(
        context: TSPluginContext,
        lang: LanguageConfig,
        scriptInfo: ts.server.ScriptInfo
    ) {
        const host = this.getMapper(context, lang, scriptInfo);
        const textStorage = this.getTextStorage(scriptInfo);
        addSideEffects(textStorage, {
            lineOffsetToPosition(position_in_generated, line, offset) {
                const position_in_original = toLineChar({ line, offset });
                debug.compareMappings(
                    context,
                    { text: host.originalText, position: position_in_original },
                    { text: host.generatedText, position: position_in_generated },
                    true
                );
            },
            positionToLineOffset(position_in_original, position) {
                debug.compareMappings(
                    context,
                    { text: host.originalText, position: position_in_original },
                    { text: host.generatedText, position: position },
                    true
                );
            }
        });
    }
    private forEachLanguageFile(
        context: TSPluginContext,
        lang: LanguageConfig,
        cb: (scriptInfo: ts.server.ScriptInfo, wasJustCreated: boolean) => void
    ) {
        const scriptInfoMap = this.getScriptInfoMap(context);
        for (const { 1: scriptInfo } of scriptInfoMap) {
            if (lang.is(scriptInfo.fileName)) {
                cb(scriptInfo, false);
            }
        }
        addSideEffects(scriptInfoMap, {
            set(_, _path, scriptInfo) {
                if (lang.is(scriptInfo.fileName)) {
                    cb(scriptInfo, true); // "Typescript@4.3.0\src\server\editorServices.ts:2628"
                }
            }
        });
    }
    private disableLanguageFeatures(context: TSPluginContext, lang: LanguageConfig) {
        if (!lang.disabled || !lang.disabled.length) return;
        function voidCall(
            this: (...args: any) => any,
            returnValue: any,
            fileName: string,
            ...args: any[]
        ) {
            if (lang.is(fileName)) return returnValue;
            return this(fileName, ...args);
        }
        for (const name of lang.disabled) {
            if (name in LanguageServiceVoidReturn) {
                const fn = context.languageService[name].bind(context.languageService);
                const returnValue = LanguageServiceVoidReturn[name]; // @ts-expect-error
                context.languageService[name] = voidCall.bind(fn, returnValue);
            } else if (debug.enabled) {
                if (!(name in context.languageService)) {
                    debug.throw(`LanguageService.${name} does not exist`);
                } else {
                    debug.throw(`LanguageService.${name}() is not void-able`);
                }
            }
        }
    }
    private getGeneratedPluginName(lang: LanguageConfig) {
        return `AutoGenerated${debug.getFancyPluginName(`"${lang.extension}"`)}`;
    }
    private resolveLanguageRootFiles(context: TSPluginContext, lang: LanguageConfig) {
        const extraFileExtension: ts.FileExtensionInfo = {
            extension: lang.extension,
            isMixedContent: false,
            scriptKind: context.ts.ScriptKind.Deferred
        };
        const plugin: ts.server.PluginModuleWithName = {
            name: this.getGeneratedPluginName(lang),
            module: {
                create(o) {
                    return o.languageService;
                },
                getExternalFiles(project) {
                    return project.getRootFiles().filter(lang.is);
                }
            }
        };
        this.getHostConfig(context).extraFileExtensions.push(extraFileExtension);
        const plugins = this.getProjectPlugins(context);
        if (plugins.some((p) => p.name === plugin.name)) {
            debug.throw(`Activated an auto-generated plugin twice`);
        } else {
            plugins.push(plugin);
        }
	}
	private patchCompilerOptions(context: TSPluginContext, lang: LanguageConfig) {
		const { ts } = context;
		switch (lang.scriptKind) {
			case ts.ScriptKind.JSX:
			case ts.ScriptKind.TSX: {
				const compilerOptions = context.project.getCompilerOptions();
				if (!compilerOptions.jsx) compilerOptions.jsx = ts.JsxEmit.Preserve;
			}
		}
	}
    private getFailedLookupLocations(
        context: TSPluginContext,
        moduleName: string,
        containingFile: string
    ): string[] {
        const r = context.project.getResolvedModuleWithFailedLookupLocationsFromCache!(
            moduleName,
            containingFile
        );
        // @ts-expect-error
        return r.failedLookupLocations;
    }
    private resolveModuleName(
        context: TSPluginContext,
        moduleName: string,
        containingFile: string
    ) {
        const { ts } = context;
        if (ts.pathIsRelative(moduleName)) {
            return ts.resolvePath(ts.getDirectoryPath(containingFile), moduleName);
        } else {
            const index_ts = '/index.ts';
            for (const loc of this.getFailedLookupLocations(context, moduleName, containingFile)) {
                if (loc.endsWith(index_ts)) {
                    const file = loc.slice(0, index_ts.length);
                    if (context.project.fileExists(file)) {
                        return ts.resolvePath(file);
                    }
                }
            }
        }
    }
    private resolveLanguageModules(context: TSPluginContext, lang: LanguageConfig) {
        return override(context.languageServiceHost, {
            resolveModuleNames: (_, moduleNames, containingFile, ...rest) => {
                const langModules: ts.ResolvedModuleFull[] = [];
                const otherModulesNames: string[] = [];
                const otherModulesIndex: number[] = [];
                for (let i = 0, j = 0, k = 0; i !== moduleNames.length; i++) {
                    if (lang.is(moduleNames[i])) {
                        const resolvedFileName = this.resolveModuleName(
                            context,
                            moduleNames[i],
                            containingFile
                        );
                        if (resolvedFileName) {
                            const resolvedModule: ts.ResolvedModuleFull = {
                                extension: lang.extensionKind,
                                isExternalLibraryImport: false,
                                resolvedFileName
                            };
                            langModules[j++] = resolvedModule;
                            continue;
                        }
                    }
                    otherModulesNames[k] = moduleNames[i];
                    otherModulesIndex[k++] = i;
                }
                // prettier-ignore
                const notLangModules = _(otherModulesNames, containingFile, ...rest);
                const resolvedModules: (
                    | ts.ResolvedModuleFull
                    | ts.ResolvedModule
                    | undefined
                )[] = [];
                for (let i = 0, j = 0, k = 0; i !== moduleNames.length; i++) {
                    if (k < otherModulesIndex.length && otherModulesIndex[k] === i) {
                        resolvedModules[i] = notLangModules[k++];
                    } else {
                        resolvedModules[i] = langModules[j++];
                    }
                }
                return resolvedModules;
            }
        });
    }
    enableLanguageSupport(context: TSPluginContext, lang: LanguageConfig) {
        if (!this.TSSupportsLang(context, lang)) {
            debug.init(context);
            this.resolveLanguageModules(context, lang);
            this.resolveLanguageRootFiles(context, lang);
			this.disableLanguageFeatures(context, lang);
			this.patchCompilerOptions(context, lang);
            this.forEachLanguageFile(context, lang, (info) => {
                this.rewriteFileScriptKind(context, lang, info);
                this.rewriteFileContent(context, lang, info);
                this.rewriteFileMapping(context, lang, info);
            });
            if (debug.enabled) {
                this.setupCommonDebugLogs(context, lang);
                lang.enableDebug?.(context, debug);
                debug.log(`Reloading Projects with enabled support for "${lang.extension}" files.`);
            }
            context.project.projectService.reloadProjects(); // "Typescript@4.3.0\src\server\editorServices.ts:2855"
        }
    }
    private setupCommonDebugLogs(context: TSPluginContext, lang: LanguageConfig) {
        debug.log(
            `${debug.pluginName} Initialized with config : ${JSON.stringify(context.config)}`
        );
        LanguageService: {
            debug.everyCall(context.languageService, {
                ifFirstArg: lang.is,
                name: 'LanguageService',
                keys: Object.keys(LanguageServiceVoidReturn).filter(
                    (key) => !lang?.disabled.includes(key as any)
                )
            });
            if (lang.disabled) {
                debug.everyCall(context.languageService, {
                    ifFirstArg: lang.is,
                    name: 'LanguageService',
                    keys: lang.disabled,
                    format(obj, method) {
                        return `${obj}.${method}(): void (disabled)`;
                    }
                });
            }
        }
        Project: {
            addSideEffects(context.project, {
                getScriptSnapshot(snapshot, fileName) {
                    if (!lang.is(fileName)) return;
                    const { project, ts } = context;
                    const scriptInfo = project.getScriptInfo(fileName)!;
                    const call = debug.formatCall(
                        'Project',
                        'getScriptSnapshot',
                        quote(debug.projectPath(fileName))
                    );
                    const extension =
                        getExtensionFromScriptKind(context, scriptInfo?.scriptKind)?.replace(
                            /^\.?/,
                            ''
                        ) ?? extensionFromFileName(fileName);
                    debug.logFileContent(
                        scriptInfo,
                        call,
                        extension,
                        snapshot && getText(snapshot)
                    );
                }
            });
        }
        ScriptInfo: {
            this.forEachLanguageFile(context, lang, (scriptInfo, wasJustCreated) => {
                const { fileName } = scriptInfo;
                debug.log(
                    `${wasJustCreated ? 'Created' : 'Patched'} ScriptInfo for "${debug.projectPath(
                        fileName
                    )}"`
                );
                debug.everyCall(scriptInfo, {
                    name: `"${debug.projectPath(fileName)}" | ScriptInfo`
                });
            });
        }
        TextStorage: {
            this.forEachLanguageFile(context, lang, (scriptInfo) => {
                const { fileName } = scriptInfo;
                const textStorage = this.getTextStorage(scriptInfo);
                debug.everyCall(textStorage, {
                    name: `"${debug.projectPath(fileName)}" | TextStorage`
                });
                this.debugAssertMappings(context, lang, scriptInfo);
            });
        }
        resolveModuleNames: {
            addSideEffects(context.languageServiceHost, {
                resolveModuleNames: (resolvedModules, moduleNames) => {
                    let i = 0;
                    for (const name of moduleNames) {
                        if (lang.is(name)) {
                            const r = resolvedModules[i] as ts.ResolvedModuleFull | undefined;
                            const as_extension = r?.extension ? ` as a "${r.extension}" file` : '';
                            if (r)
                                debug.log(
                                    `Resolved "${name}" to "${r.resolvedFileName}"${as_extension}`
                                );
                            else debug.log(`Failed to resolved module "${name}".`);
                        }
                        i++;
                    }
                }
            });
        }
        generatedPlugin: {
            const generated_name = this.getGeneratedPluginName(lang);
            const own_plugin = this.getProjectPlugins(context).find(
                (plugin) => plugin.name === generated_name
            );
            if (own_plugin)
                override(own_plugin.module, {
                    getExternalFiles(_, project) {
                        const r = _(project);
                        debug.log(
                            `AutoGeneratedPlugin.getExternalFiles("${
                                lang.extension
                            }") -> ${JSON.stringify(r)}`
                        );
                        return r;
                    }
                });
            else {
                debug.log(`Failed to attach logger to auto-generated plugin.`);
            }
        }
    }
    private TSSupportsLang(context: TSPluginContext, lang: LanguageConfig) {
        return (
            this.getHostConfig(context).extraFileExtensions?.some(
                (item) => lang.extension === item.extension
            ) || Object.values(context.ts.Extension).includes(lang.extension as any)
        );
    }
    private rewriteFileScriptKind(
        context: TSPluginContext,
        lang: LanguageConfig,
        scriptInfo: ts.server.ScriptInfo
    ) {
        // @ts-expect-error
        scriptInfo.scriptKind = lang.scriptKind ?? context.ts.ScriptKind.TSX;
    }
    private getTextStorage(scriptInfo: ts.server.ScriptInfo): tsInternalServerHelpers.TextStorage {
        // @ts-expect-error
        return scriptInfo.textStorage;
    }
    private getScriptInfoMap(context: TSPluginContext): Map<string, ts.server.ScriptInfo> {
        // @ts-expect-error
        return context.project.projectService.filenameToScriptInfo;
    }
    private getHostConfig(context: TSPluginContext): ts.server.HostConfiguration {
        // @ts-expect-error
        const config = context.project.projectService.hostConfiguration;
        if (!config.extraFileExtensions) config.extraFileExtensions = [];
        return config;
    }
    private getProjectPlugins(context: TSPluginContext): ts.server.PluginModuleWithName[] {
        // @ts-expect-error
        return context.project.plugins;
    }
})();
const EmptyArray = [];
const LanguageServiceVoidReturn = {
    getSyntacticDiagnostics: EmptyArray,
    getSemanticDiagnostics: EmptyArray,
    getSuggestionDiagnostics: EmptyArray,
    getEncodedSyntacticClassifications: { spans: EmptyArray, endOfLineState: 0 },
    getEncodedSemanticClassifications: { spans: EmptyArray, endOfLineState: 0 },
    getCompletionsAtPosition: undefined,
    getCompletionEntryDetails: undefined,
    getCompletionEntrySymbol: undefined,
    getQuickInfoAtPosition: undefined,
    getNameOrDottedNameSpan: undefined,
    getBreakpointStatementAtPosition: undefined,
    getSignatureHelpItems: undefined,
    get getRenameInfo() {
        return {
            canRename: false,
            localizedErrorMessage: `${debug.pluginName} does not support the "getRenameInfo" command.`
        };
    },
    findRenameLocations: undefined,
    getSmartSelectionRange: { textSpan: { start: -1, length: -1 } },
    getDefinitionAtPosition: undefined,
    getDefinitionAndBoundSpan: undefined,
    getTypeDefinitionAtPosition: undefined,
    getImplementationAtPosition: undefined,
    getReferencesAtPosition: undefined,
    findReferences: undefined,
    getDocumentHighlights: undefined,
    getFileReferences: EmptyArray,
    getNavigationBarItems: EmptyArray,
    prepareCallHierarchy: undefined,
    provideCallHierarchyIncomingCalls: EmptyArray,
    provideCallHierarchyOutgoingCalls: EmptyArray,
    getOutliningSpans: EmptyArray,
    getTodoComments: EmptyArray,
    getBraceMatchingAtPosition: EmptyArray,
    getIndentationAtPosition: -1,
    getFormattingEditsForRange: EmptyArray,
    getFormattingEditsForDocument: EmptyArray,
    getFormattingEditsAfterKeystroke: EmptyArray,
    getDocCommentTemplateAtPosition: undefined,
    isValidBraceCompletionAtPosition: false,
    getJsxClosingTagAtPosition: undefined,
    getSpanOfEnclosingComment: undefined,
    getCodeFixesAtPosition: EmptyArray,
    getApplicableRefactors: EmptyArray,
    getEditsForRefactor: undefined,
    toggleLineComment: EmptyArray,
    toggleMultilineComment: EmptyArray,
    commentSelection: EmptyArray,
    uncommentSelection: EmptyArray
};

export const enableLanguageSupport = tsInternals.enableLanguageSupport.bind(tsInternals);
