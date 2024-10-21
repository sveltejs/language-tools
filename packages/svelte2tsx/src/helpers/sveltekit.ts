import path from 'path';
import type ts from 'typescript';
import { findExports } from './typescript';

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
    surround: (text: string) => string = (text) => text
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

    return { text, addedCode };
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
        const pos = load.node.parameters[0].getEnd();
        const inserted = surround(
            `: import('./$types.js').${basename.includes('layout') ? 'Layout' : 'Page'}${
                basename.includes('server') ? 'Server' : ''
            }LoadEvent`
        );

        insert(pos, inserted);
    } else if (load?.type === 'var' && !load.hasTypeDefinition) {
        // "const load = ..." will be transformed into
        // "const load = (...) satisfies PageLoad"
        insert(load.node.initializer.getStart(), surround('('));
        insert(
            load.node.initializer.getEnd(),
            surround(
                `) satisfies import('./$types.js').${basename.includes('layout') ? 'Layout' : 'Page'}${
                    basename.includes('server') ? 'Server' : ''
                }Load`
            )
        );
    }

    // add type to entries function if not explicitly typed
    const entries = exports.get('entries');
    if (
        entries?.type === 'function' &&
        entries.node.parameters.length === 0 &&
        !entries.hasTypeDefinition &&
        !basename.includes('layout')
    ) {
        if (!entries.node.type && entries.node.body) {
            const returnPos = ts.isArrowFunction(entries.node)
                ? entries.node.equalsGreaterThanToken.getStart()
                : entries.node.body.getStart();
            const returnInsertion = surround(`: ReturnType<import('./$types.js').EntryGenerator> `);
            insert(returnPos, returnInsertion);
        }
    }

    // add type to actions variable if not explicitly typed
    const actions = exports.get('actions');
    if (actions?.type === 'var' && !actions.hasTypeDefinition && actions.node.initializer) {
        const pos = actions.node.initializer.getEnd();
        const inserted = surround(` satisfies import('./$types.js').Actions`);
        insert(pos, inserted);
    }

    addTypeToVariable(exports, surround, insert, 'prerender', `boolean | 'auto'`);
    addTypeToVariable(exports, surround, insert, 'trailingSlash', `'never' | 'always' | 'ignore'`);
    addTypeToVariable(exports, surround, insert, 'ssr', `boolean`);
    addTypeToVariable(exports, surround, insert, 'csr', `boolean`);

    // add types to GET/PUT/POST/PATCH/DELETE/OPTIONS/HEAD if not explicitly typed
    const insertApiMethod = (name: string) => {
        addTypeToFunction(
            ts,
            exports,
            surround,
            insert,
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

    addTypeToFunction(ts, exports, surround, insert, 'match', 'string', 'boolean');

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
        addTypeToFunction(ts, exports, surround, insert, name, type);
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

    addTypeToFunction(ts, exports, surround, insert, 'reroute', `import('@sveltejs/kit').Reroute`);

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
    name: string,
    type: string
) {
    const variable = exports.get(name);
    if (variable?.type === 'var' && !variable.hasTypeDefinition && variable.node.initializer) {
        const pos = variable.node.name.getEnd();
        const inserted = surround(` : ${type}`);
        insert(pos, inserted);
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
    name: string,
    type: string,
    returnType?: string
) {
    const fn = exports.get(name);
    if (fn?.type === 'function' && fn.node.parameters.length === 1 && !fn.hasTypeDefinition) {
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
    }
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
