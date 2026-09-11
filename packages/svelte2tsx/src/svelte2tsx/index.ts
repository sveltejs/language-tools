import MagicString from 'magic-string';
import ts from 'typescript';
import { convertHtmlxToJsx, TemplateProcessResult } from '../htmlxtojsx_v2';
import { parseHtmlx } from '../utils/htmlxparser';
import { addComponentExport } from './addComponentExport';
import { createRenderFunction } from './createRenderFunction';
import { ExportedNames } from './nodes/ExportedNames';
import { Generics } from './nodes/Generics';
import { ImplicitStoreValues } from './nodes/ImplicitStoreValues';
import { processInstanceScriptContent } from './processInstanceScriptContent';
import { createModuleAst, ModuleAst, processModuleScriptTag } from './processModuleScriptTag';
import path from 'path';
import { parse, VERSION } from 'svelte/compiler';
import { getTopLevelImports } from './utils/tsAst';
import { RewriteExternalImportsOptions } from '../helpers/rewriteExternalImports';

/**
 * Cache for reusing internal TypeScript ASTs across svelte2tsx invocations.
 * Pass the same cache object on repeated calls for the same file to enable
 * incremental TS reparsing of script contents via `ts.updateSourceFile()`.
 */
export interface Svelte2TsxCache {
    instanceScriptAst?: ts.SourceFile;
    instanceScriptContent?: string;
    moduleScriptAst?: ts.SourceFile;
    moduleScriptContent?: string;
}

/**
 * Compute a ts.TextChangeRange by scanning for common prefix and suffix.
 */
function computeScriptChangeRange(oldText: string, newText: string): ts.TextChangeRange {
    let prefixLen = 0;
    const minLen = Math.min(oldText.length, newText.length);
    while (prefixLen < minLen && oldText.charCodeAt(prefixLen) === newText.charCodeAt(prefixLen)) {
        prefixLen++;
    }
    let oldSuffix = oldText.length;
    let newSuffix = newText.length;
    while (
        oldSuffix > prefixLen &&
        newSuffix > prefixLen &&
        oldText.charCodeAt(oldSuffix - 1) === newText.charCodeAt(newSuffix - 1)
    ) {
        oldSuffix--;
        newSuffix--;
    }
    return {
        span: { start: prefixLen, length: oldSuffix - prefixLen },
        newLength: newSuffix - prefixLen
    };
}

/**
 * Create or incrementally update a ts.SourceFile for script content.
 * Falls back to full parse if cache is unavailable or content is unchanged.
 */
function getOrUpdateSourceFile(
    fileName: string,
    scriptContent: string,
    cache: Svelte2TsxCache | undefined,
    cacheKey: 'instanceScript' | 'moduleScript'
): ts.SourceFile {
    const astKey = `${cacheKey}Ast` as const;
    const contentKey = `${cacheKey}Content` as const;

    if (cache?.[astKey] && cache[contentKey] && cache[contentKey] !== scriptContent) {
        const changeRange = computeScriptChangeRange(cache[contentKey]!, scriptContent);
        const updated = ts.updateSourceFile(cache[astKey]!, scriptContent, changeRange);
        cache[astKey] = updated;
        cache[contentKey] = scriptContent;
        return updated;
    }

    const ast = ts.createSourceFile(
        fileName,
        scriptContent,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
    );

    if (cache) {
        cache[astKey] = ast;
        cache[contentKey] = scriptContent;
    }

    return ast;
}

function processSvelteTemplate(
    str: MagicString,
    parse: typeof import('svelte/compiler').parse,
    options: {
        emitOnTemplateError?: boolean;
        namespace?: string;
        accessors?: boolean;
        mode?: 'ts' | 'dts';
        typingsNamespace?: string;
        svelte5Plus: boolean;
        emitJsDoc?: boolean;
        isTsFile?: boolean;
        rewriteExternalImports?: RewriteExternalImportsOptions;
    }
): TemplateProcessResult {
    const { htmlxAst, tags } = parseHtmlx(str.original, parse, options);
    return convertHtmlxToJsx(str, htmlxAst, tags, options);
}

export function svelte2tsx(
    svelte: string,
    options: {
        parse?: typeof import('svelte/compiler').parse;
        version?: string;
        filename?: string;
        isTsFile?: boolean;
        emitOnTemplateError?: boolean;
        namespace?: string;
        mode?: 'ts' | 'dts';
        accessors?: boolean;
        typingsNamespace?: string;
        noSvelteComponentTyped?: boolean;
        /**
         * If true, emits JSDoc annotations for types in JS files instead of TypeScript syntax.
         * This is useful for svelte-check's incremental mode where the output needs to be
         * valid JS that tsc can process without errors.
         */
        emitJsDoc?: boolean;
        rewriteExternalImports?: {
            workspacePath: string;
            generatedPath: string;
        };
        /**
         * Optional cache for reusing internal TypeScript ASTs across invocations.
         * Pass the same object for repeated calls on the same file to enable
         * incremental TS reparsing (~2x faster script parsing).
         */
        cache?: Svelte2TsxCache;
    } = { parse }
) {
    options.mode = options.mode || 'ts';
    options.version = options.version || VERSION;

    const str = new MagicString(svelte);

    const rewriteExternalImportsOptions: RewriteExternalImportsOptions | undefined =
        options.rewriteExternalImports && options.filename
            ? {
                  sourcePath: options.filename,
                  generatedPath: options.rewriteExternalImports.generatedPath,
                  workspacePath: options.rewriteExternalImports.workspacePath
              }
            : undefined;
    const basename = path.basename(options.filename || '');
    const svelte5Plus = Number(options.version![0]) > 4;
    const isTsFile = options?.isTsFile;
    const emitJsDoc = options?.emitJsDoc ?? false;

    // process the htmlx as a svelte template
    let {
        htmlAst,
        moduleScriptTag,
        scriptTag,
        rootSnippets,
        slots,
        uses$$props,
        uses$$slots,
        uses$$restProps,
        events,
        componentDocumentation,
        resolvedStores,
        usesAccessors,
        isRunes
    } = processSvelteTemplate(str, options.parse || parse, {
        ...options,
        svelte5Plus,
        rewriteExternalImports: rewriteExternalImportsOptions
    });

    /* Rearrange the script tags so that module is first, and instance second followed finally by the template
     * This is a bit convoluted due to some trouble I had with magic string. A simple str.move(start,end,0) for each script wasn't enough
     * since if the module script was already at 0, it wouldn't move (which is fine) but would mean the order would be swapped when the script tag tried to move to 0
     * In this case we instead have to move it to moduleScriptTag.end. We track the location for the script move in the MoveInstanceScriptTarget var
     */
    let instanceScriptTarget = 0;

    let moduleAst: ModuleAst | undefined;

    if (moduleScriptTag) {
        const moduleScriptContent = svelte.substring(
            moduleScriptTag.content.start,
            moduleScriptTag.content.end
        );
        const moduleScriptAst = getOrUpdateSourceFile(
            'component.module.ts.svelte',
            moduleScriptContent,
            options.cache,
            'moduleScript'
        );
        moduleAst = createModuleAst(str, moduleScriptTag, moduleScriptAst);

        if (moduleScriptTag.start != 0) {
            //move our module tag to the top
            str.move(moduleScriptTag.start, moduleScriptTag.end, 0);
        } else {
            //since our module script was already at position 0, we need to move our instance script tag to the end of it.
            instanceScriptTarget = moduleScriptTag.end;
        }
    }

    const renderFunctionStart = scriptTag
        ? str.original.lastIndexOf('>', scriptTag.content.start) + 1
        : instanceScriptTarget;
    const implicitStoreValues = new ImplicitStoreValues(
        resolvedStores,
        renderFunctionStart,
        svelte5Plus
    );
    //move the instance script and process the content
    let exportedNames = new ExportedNames(
        str,
        0,
        basename,
        isTsFile,
        svelte5Plus,
        isRunes,
        emitJsDoc
    );
    let generics = new Generics(str, 0, { attributes: [] } as any);
    let uses$$SlotsInterface = false;
    let hasTopLevelAwait = false;
    if (scriptTag) {
        //ensure it is between the module script and the rest of the template (the variables need to be declared before the jsx template)
        if (scriptTag.start != instanceScriptTarget) {
            str.move(scriptTag.start, scriptTag.end, instanceScriptTarget);
        }
        const instanceScriptContent = svelte.substring(
            scriptTag.content.start,
            scriptTag.content.end
        );
        const instanceScriptAst = getOrUpdateSourceFile(
            'component.ts.svelte',
            instanceScriptContent,
            options.cache,
            'instanceScript'
        );
        const res = processInstanceScriptContent(
            str,
            scriptTag,
            events,
            implicitStoreValues,
            options.mode,
            moduleAst,
            isTsFile,
            basename,
            svelte5Plus,
            isRunes,
            emitJsDoc,
            rewriteExternalImportsOptions,
            instanceScriptAst
        );
        uses$$props = uses$$props || res.uses$$props;
        uses$$restProps = uses$$restProps || res.uses$$restProps;
        uses$$slots = uses$$slots || res.uses$$slots;

        ({ exportedNames, events, generics, uses$$SlotsInterface, hasTopLevelAwait } = res);
    }

    exportedNames.usesAccessors = usesAccessors;
    if (svelte5Plus) {
        exportedNames.checkGlobalsForRunes(implicitStoreValues.getGlobals());
        if (hasTopLevelAwait) {
            exportedNames.enterRunesMode();
        }
    }

    //wrap the script tag and template content in a function returning the slot and exports
    createRenderFunction({
        str,
        scriptTag,
        scriptDestination: instanceScriptTarget,
        slots,
        events,
        exportedNames,
        uses$$props,
        uses$$restProps,
        uses$$slots,
        uses$$SlotsInterface,
        generics,
        hasTopLevelAwait,
        svelte5Plus,
        isTsFile,
        mode: options.mode,
        emitJsDoc
    });

    // we need to process the module script after the instance script has moved otherwise we get warnings about moving edited items
    if (moduleScriptTag) {
        processModuleScriptTag(
            str,
            moduleScriptTag,
            new ImplicitStoreValues(
                implicitStoreValues.getAccessedStores(),
                renderFunctionStart,
                svelte5Plus,
                scriptTag || options.mode === 'ts' ? undefined : (input) => `</>;${input}<>`
            ),
            moduleAst,
            rewriteExternalImportsOptions
        );
        if (!scriptTag) {
            moduleAst.tsAst.forEachChild((node) =>
                exportedNames.hoistableInterfaces.analyzeModuleScriptNode(node)
            );
        }
    }

    if (moduleScriptTag && rootSnippets.length > 0) {
        exportedNames.hoistableInterfaces.analyzeSnippets(rootSnippets);
    }

    if (moduleScriptTag || scriptTag) {
        let snippetHoistTargetForModule = 0;
        if (rootSnippets.length) {
            if (scriptTag) {
                snippetHoistTargetForModule = scriptTag.start + 1; // +1 because imports are also moved at that position, and we want to move interfaces after imports
            } else {
                const imports = getTopLevelImports(moduleAst.tsAst);
                const lastImport = imports[imports.length - 1];
                snippetHoistTargetForModule = lastImport
                    ? lastImport.end + moduleAst.astOffset
                    : moduleAst.astOffset;
                str.appendLeft(snippetHoistTargetForModule, '\n');
            }
        }

        for (const [start, end, globals] of rootSnippets) {
            const hoist_to_module =
                moduleScriptTag &&
                (globals.size === 0 ||
                    [...globals.keys()].every((id) =>
                        exportedNames.hoistableInterfaces.isAllowedReference(id)
                    ));

            if (hoist_to_module) {
                str.move(start, end, snippetHoistTargetForModule);
            } else if (scriptTag) {
                str.move(start, end, renderFunctionStart);
            }
        }
    }

    addComponentExport({
        str,
        canHaveAnyProp: !exportedNames.uses$$Props && (uses$$props || uses$$restProps),
        events,
        isTsFile,
        exportedNames,
        usesAccessors,
        usesSlots: slots.size > 0,
        fileName: options?.filename,
        componentDocumentation,
        mode: options.mode,
        generics,
        isSvelte5: svelte5Plus,
        hasTopLevelAwait,
        noSvelteComponentTyped: options.noSvelteComponentTyped,
        emitJsDoc
    });

    if (options.mode === 'dts') {
        // Prepend the import which is used for TS files
        // The other shims need to be provided by the user ambient-style,
        // for example through filenames.push(require.resolve('svelte2tsx/svelte-shims.d.ts'))
        // TODO replace with SvelteComponent for Svelte 5, keep old for backwards compatibility with Svelte 3
        if (options.noSvelteComponentTyped) {
            str.prepend('import { SvelteComponent } from "svelte"\n' + '\n');
        } else {
            str.prepend('import { SvelteComponentTyped } from "svelte"\n' + '\n');
        }
        let code = str.toString();
        // Remove all tsx occurences and the template part from the output
        code = code
            // prepended before each script block
            .replace('<></>;', '')
            .replace('<></>;', '')
            // tsx in render function
            .replace(/<>.*<\/>/s, '')
            .replace('\n() => ();', '');

        return {
            code
        };
    } else {
        str.prepend('///<reference types="svelte" />\n');
        return {
            code: str.toString(),
            map: str.generateMap({ hires: true, source: options?.filename }),
            exportedNames: exportedNames.getExportsMap(),
            events: events.createAPI(),
            // not part of the public API so people don't start using it
            htmlAst
        };
    }
}
