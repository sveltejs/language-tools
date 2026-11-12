import {
    DocumentDiagnosticParams,
    DocumentDiagnosticReport,
    DocumentHighlight,
    DocumentHighlightParams,
    Position,
    TextDocumentIdentifier,
    TextDocumentPositionParams
} from 'vscode-languageserver';
import { DocumentManager } from '../../../lib/documents';
import { Logger } from '../../../logger';
import { TemplateAstLoader } from '../../svelte/TemplateASTLoader';
import { TsApiService } from '../TsApiService';
import { TsgoDiagnosticCode, transformDiagnosticReport } from './diagnostics';
import {
    transformHover,
    transformInlayHints,
    transformLocations,
    transformSignatureHelp
} from './languageFeatures';
import { StoreBinding, TsgoStores } from './stores';
import { relocateVirtualCodeDiagnostics } from './virtualCodeDiagnostics';

export { StoreBindingRequest } from './stores';
export type { StoreBinding } from './stores';

/**
 * Request sent by the VS Code extension from inside a TypeScript 7 LSP middleware callback
 * (`registerLspMiddleware` of the TS7 extension). It carries TS7's response for a Svelte file,
 * and the Svelte language server returns the adjusted response.
 *
 * Keeping the logic here (instead of in the extension) means it has access to the document,
 * the template AST, the other plugins and the TS7 API (virtual code, checker), and can be reused by
 * other clients / svelte-check.
 *
 * Mostly for Svelte files. References and rename also come for other files when their result
 * reaches into Svelte files (`$store` usages of a store declared in a `.ts` file).
 */
export const TransformTsgoResponseRequest = '$/transformTsgoResponse';

export interface TransformTsgoResponseParams<P = unknown, R = unknown> {
    method: string;
    params: P;
    result: R;
}

interface MultiDocumentHighlightParams {
    textDocument: TextDocumentIdentifier;
    position: Position;
}

interface MultiDocumentHighlight {
    uri: string;
    highlights: DocumentHighlight[];
}

export interface TsgoResponseTransformerHost {
    /** Highlights from the Svelte/HTML/CSS plugins */
    findDocumentHighlight(
        textDocument: TextDocumentIdentifier,
        position: Position
    ): Promise<DocumentHighlight[] | null>;
}

export class TsgoResponseTransformer {
    private readonly stores: TsgoStores | undefined;

    constructor(
        private readonly docManager: DocumentManager,
        private readonly astLoader: TemplateAstLoader,
        private readonly host: TsgoResponseTransformerHost,
        /** Connection to TS7's project state. Without it, only text/AST based rules apply */
        private readonly tsApi?: TsApiService
    ) {
        this.stores = tsApi && new TsgoStores(tsApi, (uri) => this.docManager.get(uri)?.getText());
    }

    async transform({ method, params, result }: TransformTsgoResponseParams): Promise<unknown> {
        try {
            switch (method) {
                case 'textDocument/diagnostic':
                    return await this.transformDiagnostics(
                        params as DocumentDiagnosticParams,
                        result as DocumentDiagnosticReport
                    );
                case 'textDocument/documentHighlight':
                    return await this.transformDocumentHighlight(
                        params as DocumentHighlightParams,
                        result as DocumentHighlight[] | null
                    );
                case 'custom/textDocument/multiDocumentHighlight':
                    return await this.transformMultiDocumentHighlight(
                        params as MultiDocumentHighlightParams,
                        result as MultiDocumentHighlight[] | null
                    );
                case 'textDocument/signatureHelp':
                    return transformSignatureHelp(result as any);
                case 'textDocument/hover':
                    return transformHover(result as any);
                case 'textDocument/inlayHint':
                    return transformInlayHints(result as any);
                case 'textDocument/typeDefinition':
                    return transformLocations(result as any);
                case 'textDocument/definition':
                case 'textDocument/implementation': {
                    const locations = transformLocations(result as any);
                    return this.stores
                        ? await this.stores.definition(params as any, locations)
                        : locations;
                }
                case 'textDocument/references': {
                    const locations = transformLocations(result as any);
                    return this.stores
                        ? await this.stores.references(params as any, locations)
                        : locations;
                }
                case 'textDocument/prepareRename':
                    return this.stores
                        ? await this.stores.prepareRename(params as any, result as any)
                        : result;
                case 'textDocument/rename':
                    return this.stores
                        ? await this.stores.rename(params as any, result as any)
                        : result;
                default:
                    return result;
            }
        } catch (error) {
            Logger.error(`Error transforming TypeScript 7 response for ${method}`, error);
            return result;
        }
    }

    /**
     * For the extension: where to rename when a rename starts at `$store`.
     *
     * Null means "no store subscription there", and the extension then uses TS7's own rename. That
     * rename breaks the code if it is a `$store` after all, so this fails instead of answering null
     * when it can't tell (no API connection, stale snapshot, API error).
     */
    async getStoreBinding(params: TextDocumentPositionParams): Promise<StoreBinding | null> {
        if (!this.stores) {
            throw new Error('No connection to the TypeScript API');
        }
        try {
            return await this.stores.getStoreBinding(params);
        } catch (error) {
            Logger.error('Error resolving the store of a $store', error);
            throw error;
        }
    }

    private async transformDiagnostics(
        params: DocumentDiagnosticParams,
        report: DocumentDiagnosticReport
    ): Promise<DocumentDiagnosticReport> {
        const document = this.docManager.get(params.textDocument.uri);
        // can happen for diagnostics of tabs that aren't opened (yet)
        if (!document || !report) {
            return report;
        }

        const hasVirtualCodeProblems =
            report.kind === 'full' &&
            report.items.some((d) => d.code === TsgoDiagnosticCode.VIRTUAL_CODE_PROBLEMS);
        const virtualCode =
            hasVirtualCodeProblems && this.tsApi
                ? await relocateVirtualCodeDiagnostics(
                      this.tsApi,
                      document,
                      this.astLoader.loadTemplateAst(document)
                  ).catch((error) => {
                      Logger.error('Error placing virtual code diagnostics', error);
                      return undefined;
                  })
                : undefined;

        return transformDiagnosticReport(report, { document, virtualCode });
    }

    /**
     * VS Code only asks one highlight provider (the first that returns a non-empty result).
     * So instead of letting the Svelte and TS7 providers compete, the Svelte client defers to
     * TS7 and we merge here, with the same precedence as in TS6 mode: Svelte syntax
     * (blocks, tags, HTML tags, CSS) first, TypeScript otherwise.
     */
    private async transformDocumentHighlight(
        params: DocumentHighlightParams,
        result: DocumentHighlight[] | null
    ): Promise<DocumentHighlight[] | null> {
        if (!this.docManager.get(params.textDocument.uri)) {
            return result;
        }
        const svelteHighlights = await this.host.findDocumentHighlight(
            params.textDocument,
            params.position
        );
        return svelteHighlights?.length ? svelteHighlights : result;
    }

    private async transformMultiDocumentHighlight(
        params: MultiDocumentHighlightParams,
        result: MultiDocumentHighlight[] | null
    ): Promise<MultiDocumentHighlight[] | null> {
        if (!this.docManager.get(params.textDocument.uri)) {
            return result;
        }
        const svelteHighlights = await this.host.findDocumentHighlight(
            params.textDocument,
            params.position
        );
        return svelteHighlights?.length
            ? [{ uri: params.textDocument.uri, highlights: svelteHighlights }]
            : result;
    }
}
