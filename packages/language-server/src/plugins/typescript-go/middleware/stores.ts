import {
    Location,
    LocationLink,
    Position,
    PrepareRenameParams,
    PrepareRenameResult,
    Range,
    ReferenceParams,
    RenameParams,
    TextDocumentPositionParams,
    TextEdit,
    WorkspaceEdit
} from 'vscode-languageserver';
import { normalizeUri } from '../../../utils';
import { OriginalLocation, TsApiLocationMapper } from '../TsApiLocationMapper';
import { TsApiService } from '../TsApiService';
import type { tsApiAsync, tsAst } from '../types';

/** Has to match the extension's `$store` rename middleware */
export const StoreBindingRequest = '$/tsgoStoreBinding';

export interface StoreBinding {
    uri: string;
    position: Position;
}

const storeGetName = '__sveltets_2_store_get';

export interface RequestContext {
    project: tsApiAsync.Project;
    mapper: TsApiLocationMapper;
}

/** `let $store = __sveltets_2_store_get(store)`, the hidden declaration of a `$store` subscription */
export interface Subscription {
    /** The `$store` variable */
    declaration: tsAst.VariableDeclaration & { name: tsAst.Identifier };
    /** The `store` argument */
    store: tsAst.Identifier;
}

type DefinitionResult = Location | Location[] | LocationLink[] | null;

/** `declaration` if it's the hidden `let $store = __sveltets_2_store_get(store)` */
function asSubscription(ast: typeof tsAst, declaration: tsAst.Node): Subscription | undefined {
    if (
        !ast.isVariableDeclaration(declaration) ||
        !ast.isIdentifier(declaration.name) ||
        !declaration.initializer ||
        !ast.isCallExpression(declaration.initializer)
    ) {
        return undefined;
    }
    const call = declaration.initializer;
    const store = call.arguments[0];
    if (
        !ast.isIdentifier(call.expression) ||
        call.expression.text !== storeGetName ||
        !store ||
        !ast.isIdentifier(store)
    ) {
        return undefined;
    }
    return { declaration: declaration as Subscription['declaration'], store };
}

/** The subscription whose store argument is `node` */
export function subscriptionOfArgument(
    ast: typeof tsAst,
    node: tsAst.Node
): Subscription | undefined {
    const call = node.parent;
    const declaration = call?.parent;
    const subscription = declaration && asSubscription(ast, declaration);
    return subscription && sameNode(subscription.store, node) ? subscription : undefined;
}

/**
 * The `$store` usages of a subscription in the original files (its declaration is unmapped and
 * drops out). With a `feature`, only the usages that feature may see, like in TS7's LSP.
 */
export async function findSubscriptionUsages(
    ast: typeof tsAst,
    ctx: RequestContext,
    subscription: Subscription,
    feature?: tsAst.SpanMapFeature
): Promise<OriginalLocation[]> {
    const references = await getReferences(ast, ctx, subscription.declaration.name);
    return references
        .map(({ node }) => ctx.mapper.toOriginalLocation(node, feature))
        .filter((location): location is OriginalLocation => !!location);
}

async function getReferences(
    ast: typeof tsAst,
    ctx: RequestContext,
    node: tsAst.Node
): Promise<Array<{ node: tsAst.Node; isDefinition: boolean }>> {
    const entries = await ctx.project.languageService.getReferencedSymbolsForNode(
        node,
        node.getStart()
    );
    const result = await Promise.all(
        entries.map(async (entry) => {
            const [definition, references] = await Promise.all([
                entry.definition.resolve(),
                resolveAll(entry.references)
            ]);
            const definitionName = definition && getDeclarationName(ast, definition);
            return references.map((reference) => ({
                node: reference,
                isDefinition: !!definitionName && sameNode(definitionName, reference)
            }));
        })
    );
    return result.flat();
}

/**
 * `$store` <-> `store` for references, definition/implementation and rename.
 *
 * svelte2tsx emits one unmapped `let $store = __sveltets_2_store_get(store);` per subscribed store, so
 * TS7's LSP sees `store` and `$store` as unrelated variables (rename of either side breaks code, the
 * definition of `$store` is empty). The TS7 API sees the virtual code, so we can follow that hidden
 * declaration semantically: from `$store` to its store, and from a store to every subscription of
 * it, in any file. TS7 still does scoping, aliases and cross-file work.
 *
 * Rename starting at `$store` needs TS7's rename at the `store` binding, which only the extension can
 * request (`StoreBindingRequest` gives it the position). Its result comes back through `rename`.
 */
export class TsgoStores {
    constructor(
        private readonly api: TsApiService,
        /** Text of the document as the Svelte language server knows it, if open */
        private readonly getDocumentText: (uri: string) => string | undefined
    ) {}

    private get ast() {
        return this.api.astModule;
    }

    /** References of `$store`/`store`: both sides, plus the `$store` usages of every subscription */
    async references(
        params: ReferenceParams,
        result: Location[] | null
    ): Promise<Location[] | null> {
        const references = await this.withIdentifier(
            params,
            this.ast.SpanMapFeature.References,
            async (ctx, identifier) => {
                const subscription = await this.getSubscriptionAt(ctx, identifier);
                const found = await this.findStoreReferences(
                    ctx,
                    subscription?.store ?? identifier,
                    params.context.includeDeclaration
                );
                // Plain identifiers that aren't subscribed stores: TS7's answer is complete
                return subscription || found.subscriptions > 0 ? found.locations : undefined;
            }
        );
        if (!references) {
            return result;
        }
        return dedupeLocations([...(result ?? []), ...references]);
    }

    /** TS7 finds nothing for `$store`, so go where `store` goes */
    async definition(
        params: TextDocumentPositionParams,
        result: DefinitionResult
    ): Promise<DefinitionResult> {
        const isEmpty = !result || (Array.isArray(result) && !result.length);
        if (!isEmpty || !isSvelteUri(params.textDocument.uri)) {
            return result;
        }
        const links = await this.withIdentifier(
            params,
            this.ast.SpanMapFeature.Definition,
            async (ctx, identifier) => {
                const subscription = await this.getSubscriptionAt(ctx, identifier);
                const origin = subscription && ctx.mapper.toOriginalLocation(identifier);
                if (!subscription || !origin) {
                    return undefined;
                }
                const checker = ctx.project.checker;
                let symbol = await checker.getSymbolAtLocation(subscription.store);
                if (symbol && symbol.flags & this.api.apiModule.SymbolFlags.Alias) {
                    symbol = await checker.getAliasedSymbol(symbol);
                }
                const declarations = await resolveAll(symbol?.declarations);
                return declarations
                    .map((declaration) => this.toLocationLink(ctx, declaration, origin.range))
                    .filter((link): link is LocationLink => !!link);
            }
        );
        return links?.length ? links : result;
    }

    /** Only `store` of `$store` is renamed, like in TS6 */
    async prepareRename(
        params: PrepareRenameParams,
        result: PrepareRenameResult | null
    ): Promise<PrepareRenameResult | null> {
        if (!isSvelteUri(params.textDocument.uri)) {
            return result;
        }
        const prepared = await this.withIdentifier(
            params,
            this.ast.SpanMapFeature.Rename,
            async (ctx, identifier) => {
                const subscription = await this.getSubscriptionAt(ctx, identifier);
                const location = subscription && ctx.mapper.toOriginalLocation(identifier);
                if (!location) {
                    return undefined;
                }
                const { start, end } = location.range;
                return {
                    range: Range.create(Position.create(start.line, start.character + 1), end),
                    placeholder: identifier.text.slice(1)
                };
            }
        );
        return prepared ?? result;
    }

    /**
     * Where the store of the `$store` at the position is bound in this file (import, declaration).
     * Null means that there is no store subscription at the position: the caller then uses TS7's
     * own rename. So this throws instead if it can't tell (TS7's snapshot doesn't match the
     * document), because TS7's rename of a `$store` breaks the code.
     */
    async getStoreBinding(params: TextDocumentPositionParams): Promise<StoreBinding | null> {
        if (!isSvelteUri(params.textDocument.uri)) {
            return null;
        }
        const binding = await this.withIdentifier(
            params,
            this.ast.SpanMapFeature.Rename,
            async (ctx, identifier) => {
                const subscription = await this.getSubscriptionAt(ctx, identifier);
                return subscription && (await this.getLocalBinding(ctx, subscription.store));
            },
            true
        );
        return binding ? { uri: binding.uri, position: binding.range.start } : null;
    }

    /**
     * Renaming a store also renames its `$store` usages, in every file whose local binding TS7
     * renames: `old` -> `new`, or `old` -> `old as new` (renaming at an import specifier). Not for
     * `new as old` (TS keeps the local name when renaming the export) or aliased imports.
     */
    async rename(
        params: RenameParams,
        result: WorkspaceEdit | null
    ): Promise<WorkspaceEdit | null> {
        if (!result) {
            return result;
        }
        const newName = params.newName;
        await this.withIdentifier(
            params,
            this.ast.SpanMapFeature.Rename,
            async (ctx, identifier) => {
                if (await this.getSubscriptionAt(ctx, identifier)) {
                    // starts at `$store`: the extension renames `store` instead, which comes back here
                    return;
                }
                const editsByUri = getTextEdits(result);
                for (const subscription of await this.findSubscriptions(ctx, identifier)) {
                    const binding = await this.getLocalBinding(ctx, subscription.store);
                    const edits = binding && editsByUri.get(normalizeUri(binding.uri));
                    const renamesLocalBinding = edits?.some(
                        (edit) =>
                            sameRange(edit.range, binding!.range) &&
                            (edit.newText === newName || edit.newText.endsWith(` as ${newName}`))
                    );
                    if (!edits || !renamesLocalBinding) {
                        continue;
                    }
                    for (const usage of await this.findUsages(ctx, subscription)) {
                        if (!edits.some((edit) => sameRange(edit.range, usage.range))) {
                            edits.push({ range: usage.range, newText: '$' + newName });
                        }
                    }
                }
            }
        );
        return result;
    }

    private async withIdentifier<T>(
        params: TextDocumentPositionParams,
        feature: tsAst.SpanMapFeature,
        fn: (ctx: RequestContext, identifier: tsAst.Identifier) => Promise<T | undefined>,
        /** Throw instead of answering undefined ("nothing there") if TS7's snapshot is stale */
        failOnStaleSnapshot = false
    ): Promise<T | undefined> {
        const uri = params.textDocument.uri;
        return this.api.withSourceFile(uri, async (project, sourceFile) => {
            const documentText = this.getDocumentText(uri);
            if (documentText !== undefined && documentText !== sourceFile.originalText) {
                // TS7's snapshot is ahead of or behind what the response was computed for
                if (failOnStaleSnapshot) {
                    throw new Error("TypeScript's snapshot doesn't match the document");
                }
                return undefined;
            }
            const ctx: RequestContext = { project, mapper: new TsApiLocationMapper(this.ast) };
            const offset = ctx.mapper.toOriginalOffset(sourceFile, params.position);
            for (const virtualOffset of ctx.mapper.toVirtualOffsets(sourceFile, offset, feature)) {
                const token = this.ast.getTouchingToken(sourceFile, virtualOffset);
                if (token && this.ast.isIdentifier(token)) {
                    return fn(ctx, token);
                }
            }
            return undefined;
        });
    }

    /** The subscription `identifier` (a `$store` usage) refers to */
    private async getSubscriptionAt(
        ctx: RequestContext,
        identifier: tsAst.Identifier
    ): Promise<Subscription | undefined> {
        if (!identifier.text.startsWith('$') || identifier.text.startsWith('$$')) {
            return undefined;
        }
        const symbol = await ctx.project.checker.getSymbolAtLocation(identifier);
        const declarations = await resolveAll(symbol?.declarations);
        return declarations.map((d) => asSubscription(this.ast, d)).find((s) => !!s);
    }

    /** Subscriptions of the store `node` refers to, in all files */
    private async findSubscriptions(
        ctx: RequestContext,
        node: tsAst.Node
    ): Promise<Subscription[]> {
        const references = await getReferences(this.ast, ctx, node);
        return references
            .map(({ node }) => subscriptionOfArgument(this.ast, node))
            .filter((s): s is Subscription => !!s);
    }

    /** References of the store `node` refers to, plus the `$store` usages of its subscriptions */
    private async findStoreReferences(
        ctx: RequestContext,
        node: tsAst.Node,
        includeDeclaration: boolean
    ): Promise<{ locations: Location[]; subscriptions: number }> {
        const references = await getReferences(this.ast, ctx, node);
        const locations: Location[] = [];
        const subscriptions: Subscription[] = [];
        for (const reference of references) {
            const subscription = subscriptionOfArgument(this.ast, reference.node);
            if (subscription) {
                subscriptions.push(subscription);
                continue;
            }
            if (!includeDeclaration && reference.isDefinition) {
                continue;
            }
            const location = ctx.mapper.toOriginalLocation(
                reference.node,
                this.ast.SpanMapFeature.References
            );
            if (location) {
                locations.push({ uri: location.uri, range: location.range });
            }
        }
        const usages = await Promise.all(subscriptions.map((s) => this.findUsages(ctx, s)));
        return { locations: [...locations, ...usages.flat()], subscriptions: subscriptions.length };
    }

    /** The `$store` usages of a subscription, as locations for references and rename */
    private async findUsages(ctx: RequestContext, subscription: Subscription): Promise<Location[]> {
        const usages = await findSubscriptionUsages(
            this.ast,
            ctx,
            subscription,
            this.ast.SpanMapFeature.References
        );
        return usages.map(({ uri, range }) => ({ uri, range }));
    }

    /** The local binding of the store `store` (argument of a subscription) in its file */
    private async getLocalBinding(ctx: RequestContext, store: tsAst.Identifier) {
        const symbol = await ctx.project.checker.getSymbolAtLocation(store);
        const [declaration] = await resolveAll(symbol?.declarations);
        const name = declaration && getDeclarationName(this.ast, declaration);
        return name && ctx.mapper.toOriginalLocation(name, this.ast.SpanMapFeature.Rename);
    }

    private toLocationLink(
        ctx: RequestContext,
        declaration: tsAst.Node,
        originSelectionRange: Range
    ): LocationLink | undefined {
        const name = getDeclarationName(this.ast, declaration) ?? declaration;
        const feature = this.ast.SpanMapFeature.Definition;
        const selection = ctx.mapper.toOriginalLocation(name, feature);
        if (!selection) {
            return undefined;
        }
        const target = ctx.mapper.toOriginalLocation(declaration, feature) ?? selection;
        return {
            originSelectionRange,
            targetUri: selection.uri,
            targetRange: target.range,
            targetSelectionRange: selection.range
        };
    }
}

function getDeclarationName(ast: typeof tsAst, declaration: tsAst.Node): tsAst.Node | undefined {
    const name = (declaration as { name?: tsAst.Node }).name;
    return name && ast.isIdentifier(name) ? name : undefined;
}

async function resolveAll<T extends tsAst.Node>(
    handles: readonly tsApiAsync.NodeHandle<T>[] | undefined
): Promise<T[]> {
    const nodes = await Promise.all((handles ?? []).map((handle) => handle.resolve()));
    return nodes.filter((node): node is Awaited<T> => !!node) as T[];
}

function sameNode(a: tsAst.Node, b: tsAst.Node) {
    return (
        a.pos === b.pos &&
        a.end === b.end &&
        a.getSourceFile()?.fileName === b.getSourceFile()?.fileName
    );
}

function isSvelteUri(uri: string) {
    return uri.endsWith('.svelte');
}

/** The text edits of a workspace edit by normalized uri, as mutable arrays of the edit itself */
function getTextEdits(edit: WorkspaceEdit): Map<string, TextEdit[]> {
    const result = new Map<string, TextEdit[]>();
    for (const [uri, edits] of Object.entries(edit.changes ?? {})) {
        result.set(normalizeUri(uri), edits);
    }
    for (const change of edit.documentChanges ?? []) {
        if ('textDocument' in change) {
            result.set(normalizeUri(change.textDocument.uri), change.edits as TextEdit[]);
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
    return locations.filter((location) => {
        const key = JSON.stringify([normalizeUri(location.uri), location.range]);
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}
