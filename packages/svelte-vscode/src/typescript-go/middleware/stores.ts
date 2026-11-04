import * as vscode from 'vscode';
import type {
    ExtensionAPI as TsExtensionAPI,
    Location,
    LocationLink,
    Position,
    PrepareRenameResult,
    Range,
    TextEdit,
    WorkspaceEdit
} from '@typescript/native/vscode' with { 'resolution-mode': 'import' };
import {
    findStoreBindingOffset,
    findStoreUsageOffsets,
    getIdentifierAt,
    getStoreAccessAt
} from './storeText';

/**
 * `$store` <-> `store` for rename, references, definition and implementation.
 *
 * TS7 sees the store and its `$store` subscription as two unrelated variables (the
 * `let $store = __sveltets_2_store_get(store)` line svelte2tsx emits is unmapped). Measured:
 * - rename `$store` only renames the `$store` usages, rename `store` only the `store` references
 * - references of `$store` are all `$store` usages of that file
 * - definition of `$store` is empty
 *
 * Instead of reimplementing these features, we find the other side in the text (see storeText.ts)
 * and ask TS7 again through the `vscode.execute*Provider` commands, so TS7 keeps doing scoping,
 * cross-file edits and import rewriting. Same idea as TS6's `enhanceRenamesInCaseOf$Store`.
 *
 * The nested commands go through all providers again, including this middleware. Requests we
 * issue ourselves for the `$store` side are recorded in `nestedRequests` and passed through.
 */
export function registerStoreMiddleware(
    api: TsExtensionAPI,
    isActive: () => boolean,
    log: (message: string) => void
): vscode.Disposable {
    const nestedRequests = new Set<string>();
    const isNested = (method: string, uri: string, position: Position) =>
        nestedRequests.has(requestKey(method, uri, position));

    async function nested<T>(
        method: string,
        uri: vscode.Uri,
        position: vscode.Position,
        run: () => Thenable<T>
    ): Promise<T> {
        const key = requestKey(method, uri.toString(), position);
        nestedRequests.add(key);
        try {
            return await run();
        } finally {
            nestedRequests.delete(key);
        }
    }

    /** All `$name` usages in `doc`, according to TS7 (text search finds candidates, references validate) */
    async function findStoreUsages(doc: TextView, name: string): Promise<Range[]> {
        const text = doc.getText();
        // try a few candidates in case the first ones are in strings or similar
        for (const offset of findStoreUsageOffsets(text, name).slice(0, 3)) {
            const position = doc.positionAt(offset + 1);
            const locations =
                (await nested('textDocument/references', doc.uri, position, () =>
                    vscode.commands.executeCommand<vscode.Location[]>(
                        'vscode.executeReferenceProvider',
                        doc.uri,
                        position
                    )
                )) ?? [];
            const usages = locations
                .filter(
                    (location) =>
                        location.uri.toString() === doc.uri.toString() &&
                        doc.getText(location.range) === '$' + name
                )
                .map((location) => toLspRange(location.range));
            if (usages.length) {
                return usages;
            }
        }
        return [];
    }

    async function handle<T>(method: string, result: T, run: () => Promise<T>): Promise<T> {
        if (!isActive()) {
            return result;
        }
        try {
            return await run();
        } catch (error) {
            log(`[tsgo middleware] ${method} ($store handling) failed: ${error}`);
            return result;
        }
    }

    const prepareRename = api.registerLspMiddleware(
        'textDocument/prepareRename',
        (result, { params }) =>
            handle('prepareRename', result, async () => {
                const { uri } = params.textDocument;
                if (
                    !isSvelteUri(uri) ||
                    isNested('textDocument/prepareRename', uri, params.position)
                ) {
                    return result;
                }
                const doc = await openDocument(uri);
                const text = doc.getText();
                const access = getStoreAccessAt(text, doc.offsetAt(toVsPosition(params.position)));
                if (!access || findStoreBindingOffset(text, access.name) === undefined) {
                    return result;
                }
                // Only `store` of `$store` is renamed, like in TS6
                return {
                    range: toLspRange(
                        new vscode.Range(
                            doc.positionAt(access.start + 1),
                            doc.positionAt(access.end)
                        )
                    ),
                    placeholder: access.name
                } satisfies PrepareRenameResult;
            })
    );

    const rename = api.registerLspMiddleware('textDocument/rename', (result, { params }) =>
        handle('rename', result, async () => {
            const { uri } = params.textDocument;
            if (isNested('textDocument/rename', uri, params.position)) {
                return result;
            }
            const doc = await openDocument(uri);
            const text = doc.getText();
            const offset = doc.offsetAt(toVsPosition(params.position));

            // Rename started on `$store`: rename `store` instead (which ends up in the branch below)
            const access = isSvelteUri(uri) ? getStoreAccessAt(text, offset) : undefined;
            if (access) {
                const bindingOffset = findStoreBindingOffset(text, access.name);
                if (bindingOffset === undefined) {
                    return result;
                }
                const newName = params.newName.replace(/^\$/, '');
                const position = doc.positionAt(bindingOffset);
                const edit = await vscode.commands.executeCommand<vscode.WorkspaceEdit | undefined>(
                    'vscode.executeDocumentRenameProvider',
                    doc.uri,
                    position,
                    newName
                );
                // null instead of TS7's edit, which would only rename the `$store` usages
                return edit ? toLspWorkspaceEdit(edit) : null;
            }

            // Rename of an identifier: if it's a store, also rename its `$store` usages
            const oldName = getIdentifierAt(text, offset);
            if (!oldName || !result) {
                return result;
            }
            return addStoreUsageEdits(result, oldName, params.newName);
        })
    );

    async function addStoreUsageEdits(
        edit: WorkspaceEdit,
        oldName: string,
        newName: string
    ): Promise<WorkspaceEdit> {
        for (const [uri, edits] of getTextEdits(edit)) {
            if (!isSvelteUri(uri)) {
                continue;
            }
            const doc = await openDocument(uri);
            // Only if the local binding itself is renamed: `old` -> `new`, or `old` -> `old as new`
            // (TS renaming at an import specifier). Not for `new as old` (TS keeps the local name
            // when renaming the export) or aliased imports (`$alias` stays valid).
            const renamesLocalBinding = edits.some(
                (e) =>
                    (e.newText === newName || e.newText.endsWith(` as ${newName}`)) &&
                    doc.getText(toVsRange(e.range)) === oldName
            );
            if (!renamesLocalBinding) {
                continue;
            }
            for (const range of await findStoreUsages(doc, oldName)) {
                if (!edits.some((e) => sameRange(e.range, range))) {
                    edits.push({ range, newText: '$' + newName });
                }
            }
        }
        return edit;
    }

    const references = api.registerLspMiddleware('textDocument/references', (result, { params }) =>
        handle('references', result, async () => {
            const { uri } = params.textDocument;
            if (isNested('textDocument/references', uri, params.position)) {
                return result;
            }
            const doc = await openDocument(uri);
            const text = doc.getText();
            const offset = doc.offsetAt(toVsPosition(params.position));
            const locations = [...(result ?? [])];

            // References of `$store`: add the references of `store` (+ their `$store` usages, see below)
            const access = isSvelteUri(uri) ? getStoreAccessAt(text, offset) : undefined;
            if (access) {
                const bindingOffset = findStoreBindingOffset(text, access.name);
                if (bindingOffset === undefined) {
                    return result;
                }
                const storeReferences =
                    (await vscode.commands.executeCommand<vscode.Location[]>(
                        'vscode.executeReferenceProvider',
                        doc.uri,
                        doc.positionAt(bindingOffset)
                    )) ?? [];
                return dedupeLocations([...locations, ...storeReferences.map(toLspLocation)]);
            }

            // References of an identifier: if it's a store, add its `$store` usages
            const name = getIdentifierAt(text, offset);
            if (!name || !result) {
                return result;
            }
            const svelteUris = new Set(locations.map((l) => l.uri).filter(isSvelteUri));
            for (const svelteUri of svelteUris) {
                const svelteDoc = await openDocument(svelteUri);
                const referencesLocalBinding = locations.some(
                    (l) => l.uri === svelteUri && svelteDoc.getText(toVsRange(l.range)) === name
                );
                if (referencesLocalBinding) {
                    for (const range of await findStoreUsages(svelteDoc, name)) {
                        locations.push({ uri: svelteUri, range });
                    }
                }
            }
            return dedupeLocations(locations);
        })
    );

    const definitionLike = (
        method: 'textDocument/definition' | 'textDocument/implementation',
        command: string
    ) =>
        api.registerLspMiddleware(method, (result, { params }) =>
            handle(method, result, async () => {
                const { uri } = params.textDocument;
                const isEmpty = !result || (Array.isArray(result) && !result.length);
                if (!isSvelteUri(uri) || !isEmpty || isNested(method, uri, params.position)) {
                    return result;
                }
                const doc = await openDocument(uri);
                const text = doc.getText();
                const access = getStoreAccessAt(text, doc.offsetAt(toVsPosition(params.position)));
                const bindingOffset = access && findStoreBindingOffset(text, access.name);
                if (!access || bindingOffset === undefined) {
                    return result;
                }
                // `$store` -> wherever `store` goes (itself for local stores, the module for imports)
                const targets =
                    (await vscode.commands.executeCommand<
                        Array<vscode.Location | vscode.LocationLink>
                    >(command, doc.uri, doc.positionAt(bindingOffset))) ?? [];
                const origin = toLspRange(
                    new vscode.Range(doc.positionAt(access.start), doc.positionAt(access.end))
                );
                return targets.length ? toLspLocationLinks(targets, origin) : result;
            })
        );

    return vscode.Disposable.from(
        prepareRename,
        rename,
        references,
        definitionLike('textDocument/definition', 'vscode.executeDefinitionProvider'),
        definitionLike('textDocument/implementation', 'vscode.executeImplementationProvider')
    );
}

function requestKey(method: string, uri: string, position: Position) {
    return `${method}|${vscode.Uri.parse(uri).toString()}|${position.line}:${position.character}`;
}

function isSvelteUri(uri: string) {
    return uri.endsWith('.svelte');
}

interface TextView {
    uri: vscode.Uri;
    getText(range?: vscode.Range): string;
    offsetAt(position: vscode.Position): number;
    positionAt(offset: number): vscode.Position;
}

/**
 * Text of a document without opening it: `workspace.openTextDocument` would send `didOpen` to all
 * language servers, which we only want for files we actually query (the nested commands load those).
 */
async function openDocument(uri: string): Promise<TextView> {
    const parsed = vscode.Uri.parse(uri);
    const loaded = vscode.workspace.textDocuments.find(
        (doc) => doc.uri.toString() === parsed.toString()
    );
    if (loaded) {
        return loaded;
    }
    const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(parsed));
    const lineStarts = [0];
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '\n') {
            lineStarts.push(i + 1);
        }
    }
    const offsetAt = (position: vscode.Position) =>
        Math.min((lineStarts[position.line] ?? text.length) + position.character, text.length);
    const positionAt = (offset: number) => {
        let line = 0;
        while (line + 1 < lineStarts.length && lineStarts[line + 1] <= offset) {
            line++;
        }
        return new vscode.Position(line, offset - lineStarts[line]);
    };
    return {
        uri: parsed,
        getText: (range) => (range ? text.slice(offsetAt(range.start), offsetAt(range.end)) : text),
        offsetAt,
        positionAt
    };
}

/** The text edits of a workspace edit by uri, as mutable arrays of the edit itself */
function getTextEdits(edit: WorkspaceEdit): Array<[string, TextEdit[]]> {
    const result: Array<[string, TextEdit[]]> = [];
    for (const [uri, edits] of Object.entries(edit.changes ?? {})) {
        result.push([uri, edits]);
    }
    for (const change of edit.documentChanges ?? []) {
        if ('textDocument' in change) {
            result.push([change.textDocument.uri, change.edits as TextEdit[]]);
        }
    }
    return result;
}

function sameRange(a: Range, b: Range) {
    return (
        a.start.line === b.start.line &&
        a.start.character === b.start.character &&
        a.end.line === b.end.line &&
        a.end.character === b.end.character
    );
}

function dedupeLocations(locations: Location[]): Location[] {
    const seen = new Set<string>();
    return locations.filter((l) => {
        const key = JSON.stringify([vscode.Uri.parse(l.uri).toString(), l.range]);
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

function toVsPosition(position: Position) {
    return new vscode.Position(position.line, position.character);
}

function toVsRange(range: Range) {
    return new vscode.Range(toVsPosition(range.start), toVsPosition(range.end));
}

function toLspRange(range: vscode.Range): Range {
    return {
        start: { line: range.start.line, character: range.start.character },
        end: { line: range.end.line, character: range.end.character }
    };
}

function toLspLocation(location: vscode.Location): Location {
    return { uri: location.uri.toString(), range: toLspRange(location.range) };
}

function toLspLocationLinks(
    targets: Array<vscode.Location | vscode.LocationLink>,
    originSelectionRange: Range
): LocationLink[] {
    return targets.map((target) =>
        'targetUri' in target
            ? {
                  originSelectionRange,
                  targetUri: target.targetUri.toString(),
                  targetRange: toLspRange(target.targetRange),
                  targetSelectionRange: toLspRange(
                      target.targetSelectionRange ?? target.targetRange
                  )
              }
            : {
                  originSelectionRange,
                  targetUri: target.uri.toString(),
                  targetRange: toLspRange(target.range),
                  targetSelectionRange: toLspRange(target.range)
              }
    );
}

function toLspWorkspaceEdit(edit: vscode.WorkspaceEdit): WorkspaceEdit {
    const changes: Record<string, TextEdit[]> = {};
    for (const [uri, edits] of edit.entries()) {
        changes[uri.toString()] = edits.map((e) => ({
            range: toLspRange(e.range),
            newText: e.newText
        }));
    }
    return { changes };
}
