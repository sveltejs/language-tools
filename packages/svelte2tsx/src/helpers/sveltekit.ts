import path from 'path';
import ts from 'typescript';
import { findExports } from './typescript';

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
    paramsPath: string;
}

const kitPageFiles = new Set(['+page', '+layout', '+page.server', '+layout.server', '+server']);

/**
 * Determines whether or not a given file is a SvelteKit-specific file (route file, hooks file, or params file)
 */
export function isKitFile(fileName: string, options: KitFilesSettings): boolean {
    const basename = path.basename(fileName);
    return (
        isKitRouteFile(fileName, basename) ||
        isServerHooksFile(fileName, basename, options.serverHooksPath) ||
        isClientHooksFile(fileName, basename, options.clientHooksPath) ||
        isParamsFile(fileName, basename, options.paramsPath)
    );
}

/**
 * Determines whether or not a given file is a SvelteKit-specific route file
 */
export function isKitRouteFile(fileName: string, basename: string): boolean {
    if (basename.includes('@')) {
        // +page@foo -> +page
        basename = basename.split('@')[0];
    } else {
        basename = basename.slice(0, -path.extname(fileName).length);
    }

    return kitPageFiles.has(basename);
}

/**
 * Determines whether or not a given file is a SvelteKit-specific hooks file
 */
export function isServerHooksFile(
    fileName: string,
    basename: string,
    serverHooksPath: string
): boolean {
    return (
        ((basename === 'index.ts' || basename === 'index.js') &&
            fileName.slice(0, -basename.length - 1).endsWith(serverHooksPath)) ||
        fileName.slice(0, -path.extname(basename).length).endsWith(serverHooksPath)
    );
}

/**
 * Determines whether or not a given file is a SvelteKit-specific hooks file
 */
export function isClientHooksFile(
    fileName: string,
    basename: string,
    clientHooksPath: string
): boolean {
    return (
        ((basename === 'index.ts' || basename === 'index.js') &&
            fileName.slice(0, -basename.length - 1).endsWith(clientHooksPath)) ||
        fileName.slice(0, -path.extname(basename).length).endsWith(clientHooksPath)
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
    fileName: string,
    kitFilesSettings: KitFilesSettings,
    getSource: () => ts.SourceFile | undefined,
    surround: (text: string) => string = (text) => text
): { text: string; addedCode: AddedCode[] } {
    let basename = path.basename(fileName);
    const result =
        upserKitRouteFile(fileName, basename, getSource, surround) ??
        upserKitServerHooksFile(
            fileName,
            basename,
            kitFilesSettings.serverHooksPath,
            getSource,
            surround
        ) ??
        upserKitClientHooksFile(
            fileName,
            basename,
            kitFilesSettings.clientHooksPath,
            getSource,
            surround
        ) ??
        upserKitParamsFile(fileName, basename, kitFilesSettings.paramsPath, getSource, surround);
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

function upserKitRouteFile(
    fileName: string,
    basename: string,
    getSource: () => ts.SourceFile | undefined,
    surround: (text: string) => string
) {
    if (!isKitRouteFile(fileName, basename)) return;

    const source = getSource();
    if (!source) return;

    const addedCode: AddedCode[] = [];
    const insert = (pos: number, inserted: string) => {
        insertCode(addedCode, pos, inserted);
    };

    const isTsFile = basename.endsWith('.ts');
    const exports = findExports(source, isTsFile);

    // add type to load function if not explicitly typed
    const load = exports.get('load');
    if (load?.type === 'function' && load.node.parameters.length === 1 && !load.hasTypeDefinition) {
        const pos = load.node.parameters[0].getEnd();
        const inserted = surround(
            `: import('./$types').${basename.includes('layout') ? 'Layout' : 'Page'}${
                basename.includes('server') ? 'Server' : ''
            }LoadEvent`
        );

        insert(pos, inserted);
    }

    // add type to actions variable if not explicitly typed
    const actions = exports.get('actions');
    if (actions?.type === 'var' && !actions.hasTypeDefinition && actions.node.initializer) {
        const pos = actions.node.initializer.getEnd();
        const inserted = surround(` satisfies import('./$types').Actions`);
        insert(pos, inserted);
    }

    // add type to prerender variable if not explicitly typed
    const prerender = exports.get('prerender');
    if (prerender?.type === 'var' && !prerender.hasTypeDefinition && prerender.node.initializer) {
        const pos = prerender.node.name.getEnd();
        const inserted = surround(` : boolean | 'auto'`);
        insert(pos, inserted);
    }

    // add type to trailingSlash variable if not explicitly typed
    const trailingSlash = exports.get('trailingSlash');
    if (
        trailingSlash?.type === 'var' &&
        !trailingSlash.hasTypeDefinition &&
        trailingSlash.node.initializer
    ) {
        const pos = trailingSlash.node.name.getEnd();
        const inserted = surround(` : 'never' | 'always' | 'ignore'`);
        insert(pos, inserted);
    }

    // add type to ssr variable if not explicitly typed
    const ssr = exports.get('ssr');
    if (ssr?.type === 'var' && !ssr.hasTypeDefinition && ssr.node.initializer) {
        const pos = ssr.node.name.getEnd();
        const inserted = surround(` : boolean`);
        insert(pos, inserted);
    }

    // add type to csr variable if not explicitly typed
    const csr = exports.get('csr');
    if (csr?.type === 'var' && !csr.hasTypeDefinition && csr.node.initializer) {
        const pos = csr.node.name.getEnd();
        const inserted = surround(` : boolean`);
        insert(pos, inserted);
    }

    // add types to GET/PUT/POST/PATCH/DELETE/OPTIONS if not explicitly typed
    const insertApiMethod = (name: string) => {
        const api = exports.get(name);
        if (
            api?.type === 'function' &&
            api.node.parameters.length === 1 &&
            !api.hasTypeDefinition
        ) {
            const pos = api.node.parameters[0].getEnd();
            const inserted = surround(`: import('./$types').RequestHandler`);

            insert(pos, inserted);
        }
    };
    insertApiMethod('GET');
    insertApiMethod('PUT');
    insertApiMethod('POST');
    insertApiMethod('PATCH');
    insertApiMethod('DELETE');
    insertApiMethod('OPTIONS');

    return { addedCode, originalText: source.getFullText() };
}

function upserKitParamsFile(
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
    const exports = findExports(source, isTsFile);

    // add type to match function if not explicitly typed
    const match = exports.get('match');
    if (
        match?.type === 'function' &&
        match.node.parameters.length === 1 &&
        !match.hasTypeDefinition
    ) {
        const pos = match.node.parameters[0].getEnd();
        const inserted = surround(`: string`);
        insert(pos, inserted);
        if (!match.node.type && match.node.body) {
            const returnPos = match.node.body.getStart();
            const returnInsertion = surround(`: boolean`);
            insert(returnPos, returnInsertion);
        }
    }

    return { addedCode, originalText: source.getFullText() };
}

function upserKitClientHooksFile(
    fileName: string,
    basename: string,
    clientHooksPath: string,
    getSource: () => ts.SourceFile | undefined,
    surround: (text: string) => string
) {
    if (!isClientHooksFile(fileName, basename, clientHooksPath)) {
        return;
    }

    const source = getSource();
    if (!source) return;

    const addedCode: AddedCode[] = [];
    const insert = (pos: number, inserted: string) => {
        insertCode(addedCode, pos, inserted);
    };

    const isTsFile = basename.endsWith('.ts');
    const exports = findExports(source, isTsFile);

    // add type to handleError function if not explicitly typed
    const handleError = exports.get('handleError');
    if (
        handleError?.type === 'function' &&
        handleError.node.parameters.length === 1 &&
        !handleError.hasTypeDefinition
    ) {
        const paramPos = handleError.node.parameters[0].getEnd();
        const paramInsertion = surround(
            `: Parameters<import('@sveltejs/kit').HandleClientError>[0]`
        );
        insert(paramPos, paramInsertion);
        if (!handleError.node.type && handleError.node.body) {
            const returnPos = handleError.node.body.getStart();
            const returnInsertion = surround(
                `: ReturnType<import('@sveltejs/kit').HandleClientError>`
            );
            insert(returnPos, returnInsertion);
        }
    }

    return { addedCode, originalText: source.getFullText() };
}

function upserKitServerHooksFile(
    fileName: string,
    basename: string,
    serverHooksPath: string,
    getSource: () => ts.SourceFile | undefined,
    surround: (text: string) => string
) {
    if (!isServerHooksFile(fileName, basename, serverHooksPath)) {
        return;
    }

    const source = getSource();
    if (!source) return;

    const addedCode: AddedCode[] = [];
    const insert = (pos: number, inserted: string) => {
        insertCode(addedCode, pos, inserted);
    };

    const isTsFile = basename.endsWith('.ts');
    const exports = findExports(source, isTsFile);

    const addTypeToFunction = (name: string, type: string) => {
        const fn = exports.get(name);
        if (fn?.type === 'function' && fn.node.parameters.length === 1 && !fn.hasTypeDefinition) {
            const paramPos = fn.node.parameters[0].getEnd();
            const paramInsertion = surround(`: Parameters<${type}>[0]`);
            insert(paramPos, paramInsertion);
            if (!fn.node.type && fn.node.body) {
                const returnPos = fn.node.body.getStart();
                const returnInsertion = surround(`: ReturnType<${type}>`);
                insert(returnPos, returnInsertion);
            }
        }
    };

    addTypeToFunction('handleError', `import('@sveltejs/kit').HandleServerError`);
    addTypeToFunction('handle', `import('@sveltejs/kit').Handle`);
    addTypeToFunction('handleFetch', `import('@sveltejs/kit').HandleFetch`);

    return { addedCode, originalText: source.getFullText() };
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
