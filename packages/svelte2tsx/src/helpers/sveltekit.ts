import path from 'path';
import type ts from 'typescript';
import { findExports } from './typescript';
import {
    forEachExternalImportRewrite,
    RewriteExternalImportsOptions
} from './rewriteExternalImports';

type _ts = typeof ts;

export interface AddedCode {
    generatedPos: number;
    originalPos: number;
    length: number;
    total: number;
    inserted: string;
}

export interface KitFilesSettings {
    serverHooksPath: string;
    clientHooksPath: string;
    universalHooksPath: string;
    paramsPath: string;
}

const kitPageFiles = new Set(['+page', '+layout', '+page.server', '+layout.server', '+server']);

/**
 * Determines whether or not a given file is a SvelteKit-specific file (route file, hooks file, or params file)
 */
export function isKitFile(fileName: string, options: KitFilesSettings): boolean {
    const basename = path.basename(fileName);
    return (
        isKitRouteFile(basename) ||
        isHooksFile(fileName, basename, options.serverHooksPath) ||
        isHooksFile(fileName, basename, options.clientHooksPath) ||
        isHooksFile(fileName, basename, options.universalHooksPath) ||
        isParamsFile(fileName, basename, options.paramsPath)
    );
}

/**
 * Determines whether or not a given file is a SvelteKit-specific route file
 */
export function isKitRouteFile(basename: string): boolean {
    if (basename.includes('@')) {
        // +page@foo -> +page
        basename = basename.split('@')[0];
    } else {
        basename = basename.slice(0, -path.extname(basename).length);
    }

    return kitPageFiles.has(basename);
}

/**
 * Determines whether or not a given file is a SvelteKit-specific hooks file
 */
export function isHooksFile(fileName: string, basename: string, hooksPath: string): boolean {
    return (
        ((basename === 'index.ts' || basename === 'index.js') &&
            fileName.slice(0, -basename.length - 1).endsWith(hooksPath)) ||
        fileName.slice(0, -path.extname(basename).length).endsWith(hooksPath)
    );
}

/**
 * Determines whether or not a given file is a SvelteKit-specific params file
 */
export function isParamsFile(fileName: string, basename: string, paramsPath: string): boolean {
    return (
        fileName.slice(0, -basename.length - 1).endsWith(paramsPath) &&
        !basename.includes('.test') &&
        !basename.includes('.spec')
    );
}

export function upsertKitFile(
    ts: _ts,
    fileName: string,
    kitFilesSettings: KitFilesSettings,
    getSource: () => ts.SourceFile | undefined,
    surround: (text: string) => string = (text) => text,
    rewriteExternalImports?: {
        workspacePath: string;
        generatedPath: string;
    }
): { text: string; addedCode: AddedCode[] } {
    let basename = path.basename(fileName);
    const result =
        upsertKitRouteFile(ts, basename, getSource, surround) ??
        upsertKitServerHooksFile(
            ts,
            fileName,
            basename,
            kitFilesSettings.serverHooksPath,
            getSource,
            surround
        ) ??
        upsertKitClientHooksFile(
            ts,
            fileName,
            basename,
            kitFilesSettings.clientHooksPath,
            getSource,
            surround
        ) ??
        upsertKitUniversalHooksFile(
            ts,
            fileName,
            basename,
            kitFilesSettings.universalHooksPath,
            getSource,
            surround
        ) ??
        upsertKitParamsFile(
            ts,
            fileName,
            basename,
            kitFilesSettings.paramsPath,
            getSource,
            surround
        );
    if (!result) {
        return;
    }

    // construct generated text from internal text and addedCode array
    const { originalText, addedCode } = result;
    let pos = 0;
    let text = '';
    for (const added of addedCode) {
        text += originalText.slice(pos, added.originalPos) + added.inserted;
        pos = added.originalPos;
    }
    text += originalText.slice(pos);

    if (rewriteExternalImports) {
        const source = getSource();
        if (source) {
            const rewriteOptions: RewriteExternalImportsOptions = {
                sourcePath: fileName,
                generatedPath: rewriteExternalImports.generatedPath,
                workspacePath: rewriteExternalImports.workspacePath
            };
            applyExternalImportRewritesToAddedCode(ts, source, addedCode, rewriteOptions);

            let rewritePos = 0;
            text = '';
            for (const added of addedCode) {
                text += originalText.slice(rewritePos, added.originalPos) + added.inserted;
                rewritePos = added.originalPos;
            }
            text += originalText.slice(rewritePos);
        }
    }

    return { text, addedCode };
}

function applyExternalImportRewritesToAddedCode(
    ts_impl: _ts,
    source: ts.SourceFile,
    addedCode: AddedCode[],
    rewriteOptions: RewriteExternalImportsOptions
) {
    forEachExternalImportRewrite(ts_impl, source, rewriteOptions, (module_specifier, rewrite) => {
        if (!rewrite.insertedPrefix) {
            return;
        }
        insertCode(addedCode, module_specifier.getStart(source) + 1, rewrite.insertedPrefix);
    });
}

function upsertKitRouteFile(
    ts: _ts,
    basename: string,
    getSource: () => ts.SourceFile | undefined,
    surround: (text: string) => string
) {
    if (!isKitRouteFile(basename)) return;

    const source = getSource();
    if (!source) return;

    const addedCode: AddedCode[] = [];
    const insert = (pos: number, inserted: string) => {
        insertCode(addedCode, pos, inserted);
    };

    const isTsFile = basename.endsWith('.ts');
    const exports = findExports(ts, source, isTsFile);

    // add type to load function if not explicitly typed
    const load = exports.get('load');
    if (load?.type === 'function' && load.node.parameters.length === 1 && !load.hasTypeDefinition) {
        const load_type = `import('./$types.js').${basename.includes('layout') ? 'Layout' : 'Page'}${
            basename.includes('server') ? 'Server' : ''
        }Load`;

        if (isTsFile) {
            const pos = load.node.parameters[0].getEnd();
            const inserted = surround(`: ${load_type}Event`);
            insert(pos, inserted);
        } else {
            addJsDocParamToFunction(surround, insert, ts, load.node, `${load_type}Event`);
        }
    } else if (load?.type === 'var' && !load.hasTypeDefinition) {
        const load_type = `import('./$types.js').${basename.includes('layout') ? 'Layout' : 'Page'}${
            basename.includes('server') ? 'Server' : ''
        }Load`;

        if (isTsFile) {
            // "const load = ..." will be transformed into
            // "const load = (...) satisfies PageLoad"
            insert(load.node.initializer.getStart(), surround('('));
            insert(load.node.initializer.getEnd(), surround(`) satisfies ${load_type}`));
        } else {
            addJsDocSatisfiesToVariable(surround, insert, load.node, load_type);
        }
    }

    // add type to entries function if not explicitly typed
    const entries = exports.get('entries');
    if (
        entries?.type === 'function' &&
        entries.node.parameters.length === 0 &&
        !entries.hasTypeDefinition &&
        !basename.includes('layout')
    ) {
        if (isTsFile && !entries.node.type && entries.node.body) {
            const returnPos = ts.isArrowFunction(entries.node)
                ? entries.node.equalsGreaterThanToken.getStart()
                : entries.node.body.getStart();
            const returnInsertion = surround(`: ReturnType<import('./$types.js').EntryGenerator> `);
            insert(returnPos, returnInsertion);
        } else if (!isTsFile) {
            addJsDocTypeToFunction(
                surround,
                insert,
                entries.node,
                `import('./$types.js').EntryGenerator`
            );
        }
    }

    // add type to actions variable if not explicitly typed
    const actions = exports.get('actions');
    if (actions?.type === 'var' && !actions.hasTypeDefinition && actions.node.initializer) {
        if (isTsFile) {
            const pos = actions.node.initializer.getEnd();
            const inserted = surround(` satisfies import('./$types.js').Actions`);
            insert(pos, inserted);
        } else {
            addJsDocSatisfiesToVariable(
                surround,
                insert,
                actions.node,
                `import('./$types.js').Actions`
            );
        }
    }

    addTypeToVariable(exports, surround, insert, isTsFile, 'prerender', `boolean | 'auto'`);
    addTypeToVariable(
        exports,
        surround,
        insert,
        isTsFile,
        'trailingSlash',
        `'never' | 'always' | 'ignore'`
    );
    addTypeToVariable(exports, surround, insert, isTsFile, 'ssr', `boolean`);
    addTypeToVariable(exports, surround, insert, isTsFile, 'csr', `boolean`);

    // add types to GET/PUT/POST/PATCH/DELETE/OPTIONS/HEAD if not explicitly typed
    const insertApiMethod = (name: string) => {
        addTypeToFunction(
            ts,
            exports,
            surround,
            insert,
            isTsFile,
            name,
            `import('./$types.js').RequestEvent`,
            `Response | Promise<Response>`
        );
    };
    insertApiMethod('GET');
    insertApiMethod('PUT');
    insertApiMethod('POST');
    insertApiMethod('PATCH');
    insertApiMethod('DELETE');
    insertApiMethod('OPTIONS');
    insertApiMethod('HEAD');
    insertApiMethod('fallback');

    return { addedCode, originalText: source.getFullText() };
}

function upsertKitParamsFile(
    ts: _ts,
    fileName: string,
    basename: string,
    paramsPath: string,
    getSource: () => ts.SourceFile | undefined,
    surround: (text: string) => string
) {
    if (!isParamsFile(fileName, basename, paramsPath)) {
        return;
    }

    const source = getSource();
    if (!source) return;

    const addedCode: AddedCode[] = [];
    const insert = (pos: number, inserted: string) => {
        insertCode(addedCode, pos, inserted);
    };

    const isTsFile = basename.endsWith('.ts');
    const exports = findExports(ts, source, isTsFile);

    addTypeToFunction(ts, exports, surround, insert, isTsFile, 'match', 'string', 'boolean');

    return { addedCode, originalText: source.getFullText() };
}

function upsertKitClientHooksFile(
    ts: _ts,
    fileName: string,
    basename: string,
    clientHooksPath: string,
    getSource: () => ts.SourceFile | undefined,
    surround: (text: string) => string
) {
    if (!isHooksFile(fileName, basename, clientHooksPath)) {
        return;
    }

    const source = getSource();
    if (!source) return;

    const addedCode: AddedCode[] = [];
    const insert = (pos: number, inserted: string) => {
        insertCode(addedCode, pos, inserted);
    };

    const isTsFile = basename.endsWith('.ts');
    const exports = findExports(ts, source, isTsFile);

    addTypeToFunction(
        ts,
        exports,
        surround,
        insert,
        isTsFile,
        'handleError',
        `import('@sveltejs/kit').HandleClientError`
    );

    return { addedCode, originalText: source.getFullText() };
}

function upsertKitServerHooksFile(
    ts: _ts,
    fileName: string,
    basename: string,
    serverHooksPath: string,
    getSource: () => ts.SourceFile | undefined,
    surround: (text: string) => string
) {
    if (!isHooksFile(fileName, basename, serverHooksPath)) {
        return;
    }

    const source = getSource();
    if (!source) return;

    const addedCode: AddedCode[] = [];
    const insert = (pos: number, inserted: string) => {
        insertCode(addedCode, pos, inserted);
    };

    const isTsFile = basename.endsWith('.ts');
    const exports = findExports(ts, source, isTsFile);

    const addType = (name: string, type: string) => {
        addTypeToFunction(ts, exports, surround, insert, isTsFile, name, type);
    };

    addType('handleError', `import('@sveltejs/kit').HandleServerError`);
    addType('handle', `import('@sveltejs/kit').Handle`);
    addType('handleFetch', `import('@sveltejs/kit').HandleFetch`);

    return { addedCode, originalText: source.getFullText() };
}

function upsertKitUniversalHooksFile(
    ts: _ts,
    fileName: string,
    basename: string,
    universalHooksPath: string,
    getSource: () => ts.SourceFile | undefined,
    surround: (text: string) => string
) {
    if (!isHooksFile(fileName, basename, universalHooksPath)) {
        return;
    }

    const source = getSource();
    if (!source) return;

    const addedCode: AddedCode[] = [];
    const insert = (pos: number, inserted: string) => {
        insertCode(addedCode, pos, inserted);
    };

    const isTsFile = basename.endsWith('.ts');
    const exports = findExports(ts, source, isTsFile);

    addTypeToFunction(
        ts,
        exports,
        surround,
        insert,
        isTsFile,
        'reroute',
        `import('@sveltejs/kit').Reroute`
    );

    return { addedCode, originalText: source.getFullText() };
}

function addTypeToVariable(
    exports: Map<
        string,
        | {
              type: 'function';
              node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression;
              hasTypeDefinition: boolean;
          }
        | { type: 'var'; node: ts.VariableDeclaration; hasTypeDefinition: boolean }
    >,
    surround: (text: string) => string,
    insert: (pos: number, inserted: string) => void,
    isTsFile: boolean,
    name: string,
    type: string
) {
    const variable = exports.get(name);
    if (variable?.type === 'var' && !variable.hasTypeDefinition && variable.node.initializer) {
        if (isTsFile) {
            const pos = variable.node.name.getEnd();
            const inserted = surround(` : ${type}`);
            insert(pos, inserted);
        } else {
            addJsDocTypeToVariable(surround, insert, variable.node, type);
        }
    }
}

function addTypeToFunction(
    ts: _ts,
    exports: Map<
        string,
        | {
              type: 'function';
              node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression;
              hasTypeDefinition: boolean;
          }
        | { type: 'var'; node: ts.VariableDeclaration; hasTypeDefinition: boolean }
    >,
    surround: (text: string) => string,
    insert: (pos: number, inserted: string) => void,
    isTsFile: boolean,
    name: string,
    type: string,
    returnType?: string
) {
    const fn = exports.get(name);
    if (fn?.type === 'function' && fn.node.parameters.length === 1 && !fn.hasTypeDefinition) {
        if (isTsFile) {
            const paramPos = fn.node.parameters[0].getEnd();
            const paramInsertion = surround(!returnType ? `: Parameters<${type}>[0]` : `: ${type}`);
            insert(paramPos, paramInsertion);
            if (!fn.node.type && fn.node.body) {
                const returnPos = ts.isArrowFunction(fn.node)
                    ? fn.node.equalsGreaterThanToken.getStart()
                    : fn.node.body.getStart();
                const returnInsertion = surround(
                    !returnType ? `: ReturnType<${type}> ` : `: ${returnType} `
                );
                insert(returnPos, returnInsertion);
            }
        } else {
            const jsdoc_type = returnType === undefined ? type : `(arg0: ${type}) => ${returnType}`;
            addJsDocTypeToFunction(surround, insert, fn.node, jsdoc_type);
        }
    }
}

function addJsDocTypeToVariable(
    surround: (text: string) => string,
    insert: (pos: number, inserted: string) => void,
    node: ts.VariableDeclaration,
    type: string
) {
    if (!node.initializer) {
        return;
    }

    insert(node.initializer.getStart(), surround(`/** @type {${type}} */ (`));
    insert(node.initializer.getEnd(), surround(`)`));
}

function addJsDocSatisfiesToVariable(
    surround: (text: string) => string,
    insert: (pos: number, inserted: string) => void,
    node: ts.VariableDeclaration,
    type: string
) {
    if (!node.initializer) {
        return;
    }

    insert(node.initializer.getStart(), surround(`/** @satisfies {${type}} */ (`));
    insert(node.initializer.getEnd(), surround(`)`));
}

function addJsDocTypeToFunction(
    surround: (text: string) => string,
    insert: (pos: number, inserted: string) => void,
    node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
    type: string
) {
    insert(node.getStart(), surround(`/** @type {${type}} */ `));
}

function addJsDocParamToFunction(
    surround: (text: string) => string,
    insert: (pos: number, inserted: string) => void,
    ts: _ts,
    node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
    type: string
) {
    const parameter = node.parameters[0];
    if (!parameter) {
        return;
    }

    const parameter_name = ts.isIdentifier(parameter.name) ? parameter.name.text : 'arg0';
    insert(node.getStart(), surround(`/** @param {${type}} ${parameter_name} */ `));
}

function insertCode(addedCode: AddedCode[], pos: number, inserted: string) {
    const insertionIdx = addedCode.findIndex((c) => c.originalPos > pos);
    if (insertionIdx >= 0) {
        for (let i = insertionIdx; i < addedCode.length; i++) {
            addedCode[i].generatedPos += inserted.length;
            addedCode[i].total += inserted.length;
        }
        const prevTotal = addedCode[insertionIdx - 1]?.total ?? 0;
        addedCode.splice(insertionIdx, 0, {
            generatedPos: pos + prevTotal,
            originalPos: pos,
            length: inserted.length,
            inserted,
            total: prevTotal + inserted.length
        });
    } else {
        const prevTotal = addedCode[addedCode.length - 1]?.total ?? 0;
        addedCode.push({
            generatedPos: pos + prevTotal,
            originalPos: pos,
            length: inserted.length,
            inserted,
            total: prevTotal + inserted.length
        });
    }
}

export function toVirtualPos(pos: number, addedCode: AddedCode[]) {
    let total = 0;
    for (const added of addedCode) {
        if (pos < added.originalPos) break;
        total += added.length;
    }
    return pos + total;
}

export function toOriginalPos(pos: number, addedCode: AddedCode[]) {
    let total = 0;
    let idx = 0;
    for (; idx < addedCode.length; idx++) {
        const added = addedCode[idx];
        if (pos < added.generatedPos) break;
        total += added.length;
    }

    if (idx > 0) {
        const prev = addedCode[idx - 1];
        // If pos is in the middle of an added range, return the start of the addition
        if (pos > prev.generatedPos && pos < prev.generatedPos + prev.length) {
            return { pos: prev.originalPos, inGenerated: true };
        }
    }

    return { pos: pos - total, inGenerated: false };
}
