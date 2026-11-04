import {
    DocumentDiagnosticParams,
    DocumentDiagnosticReport,
    DocumentHighlight,
    DocumentHighlightParams,
    Position,
    TextDocumentIdentifier
} from 'vscode-languageserver';
import { DocumentManager } from '../../../lib/documents';
import { Logger } from '../../../logger';
import { TemplateAstLoader } from '../../svelte/TemplateASTLoader';
import { transformDiagnosticReport } from './diagnostics';
import {
    transformHover,
    transformInlayHints,
    transformLocations,
    transformSignatureHelp
} from './languageFeatures';

/**
 * Request sent by the VS Code extension from inside a TypeScript 7 LSP middleware callback
 * (`registerLspMiddleware` of the TS7 extension). It carries TS7's response for a Svelte file,
 * and the Svelte language server returns the adjusted response.
 *
 * Keeping the logic here (instead of in the extension) means it has access to the document,
 * the template AST and the other plugins, and can be reused by other clients / svelte-check.
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
    constructor(
        private readonly docManager: DocumentManager,
        private readonly astLoader: TemplateAstLoader,
        private readonly host: TsgoResponseTransformerHost
    ) {}

    async transform({ method, params, result }: TransformTsgoResponseParams): Promise<unknown> {
        try {
            switch (method) {
                case 'textDocument/diagnostic':
                    return this.transformDiagnostics(
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
                case 'textDocument/definition':
                case 'textDocument/typeDefinition':
                case 'textDocument/implementation':
                case 'textDocument/references':
                    return transformLocations(result as any);
                default:
                    return result;
            }
        } catch (error) {
            Logger.error(`Error transforming TypeScript 7 response for ${method}`, error);
            return result;
        }
    }

    private transformDiagnostics(
        params: DocumentDiagnosticParams,
        report: DocumentDiagnosticReport
    ): DocumentDiagnosticReport {
        const document = this.docManager.get(params.textDocument.uri);
        // can happen for diagnostics of tabs that aren't opened (yet)
        if (!document || !report) {
            return report;
        }

        return transformDiagnosticReport(report, {
            document,
            ast: this.astLoader.loadTemplateAst(document)
        });
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
