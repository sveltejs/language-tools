import { TsApiService } from '../TsApiService';
import { FindComponentReferencesProvider } from '../../interfaces';
import { Location } from 'vscode-languageserver-types';
import { tsApiAsync, tsAst } from '../types';
import { isNotNullOrUndefined, pathToUrl } from '../../../utils';
import { CancellationToken } from 'vscode-languageserver-protocol';
import { getDeclarationFromName, waitWithCancellation } from './utils';
import { SvelteTsSourceFileDocument } from '../SvelteSourceFileDocument';

export class TsGoComponentReferenceProvider implements FindComponentReferencesProvider {
    private readonly tsApiService: TsApiService;

    constructor(tsApiService: TsApiService) {
        this.tsApiService = tsApiService;
    }

    async findComponentReferences(uri: string): Promise<Location[] | null> {
        return this.findComponentReferencesWorker(uri, { includeDeclaration: true });
    }

    async findComponentReferencesForCodeLens(
        uri: string,
        cancellationToken: CancellationToken | undefined
    ): Promise<Location[] | null> {
        return this.findComponentReferencesWorker(uri, {
            includeDeclaration: false,
            cancellationToken
        });
    }

    private async findComponentReferencesWorker(
        uri: string,
        options: {
            includeDeclaration: boolean;
            cancellationToken?: CancellationToken | undefined;
        }
    ): Promise<Location[] | null> {
        const project = await this.tsApiService.getProject(uri);
        if (!project || options.cancellationToken?.isCancellationRequested) {
            return null;
        }

        const file = await project.program.getSourceFile({ uri });
        if (!file || options.cancellationToken?.isCancellationRequested) {
            return null;
        }

        const node = this.findDefinitionNode(file);
        if (!node) {
            return null;
        }

        const refs = await project.languageService.getReferencedSymbolsForNode(
            node,
            node.getStart()
        );
        if (options.cancellationToken?.isCancellationRequested) {
            return null;
        }
        const locationPromises: Promise<Location | null>[] = [];
        const documents = new Map<string, SvelteTsSourceFileDocument>();
        for (const entry of refs) {
            const symbol = entry.symbol;
            const symbolDeclarations = options.includeDeclaration
                ? undefined
                : await this.resolveDeclaration(symbol, options.cancellationToken);

            if (options.cancellationToken?.isCancellationRequested) {
                return null;
            }
            for (const ref of entry.references) {
                locationPromises.push(
                    this.toLocation(ref, symbolDeclarations, documents, options.includeDeclaration)
                );
            }
        }

        const result = await waitWithCancellation(locationPromises, options.cancellationToken);

        return result.filter(isNotNullOrUndefined);
    }

    private async resolveDeclaration(
        symbol: tsApiAsync.Symbol | undefined,
        cancelationToken?: CancellationToken | undefined
    ) {
        const declarations = await waitWithCancellation(
            symbol?.declarations?.map((v) => v.resolve()) || [],
            cancelationToken
        );
        return declarations.filter(isNotNullOrUndefined);
    }

    private findDefinitionNode(file: tsAst.SourceFile) {
        const astModule = this.tsApiService.astModule;
        for (const statement of file?.statements || []) {
            if (
                astModule.isClassDeclaration(statement) &&
                statement.modifierFlags & astModule.ModifierFlags.Default
            ) {
                return statement.name;
            }

            if (
                astModule.isExportAssignment(statement) &&
                astModule.isIdentifier(statement.expression)
            ) {
                return statement.expression;
            }
        }
        return null;
    }

    private async toLocation(
        nodeHandle: tsApiAsync.NodeHandle,
        symbolDeclaration: tsAst.Node[] | undefined,
        documents: Map<string, SvelteTsSourceFileDocument>,
        includeDeclaration: boolean
    ) {
        const node = await nodeHandle.resolve();
        if (!node) {
            return null;
        }
        if (!includeDeclaration && this.isDeclarationOfSymbol(symbolDeclaration, node)) {
            return null;
        }

        const sourceFile = node.getSourceFile();
        if (!sourceFile) {
            return null;
        }
        const startOffset = node.getStart();
        const endOffset = node.getEnd();
        const uri = pathToUrl(sourceFile.fileName);
        if (!sourceFile.spanMap) {
            const start = sourceFile.getLineAndCharacterOfPosition(startOffset);
            const end = sourceFile.getLineAndCharacterOfPosition(endOffset);
            return {
                uri,
                range: {
                    start,
                    end
                }
            };
        }

        const originRange = sourceFile.spanMap?.virtualToOriginalSpan({
            pos: startOffset,
            end: endOffset
        });
        if (!originRange) {
            return null;
        }

        const isComponentDef = originRange.range.pos === 0;
        if (isComponentDef) {
            return null;
        }

        const isEndTag =
            sourceFile.originalText.charCodeAt(startOffset - 1) === 47 /* '/' */ &&
            sourceFile.originalText.charCodeAt(startOffset - 2) === 60; /* '<' */

        if (isEndTag) {
            return null;
        }
        let spanMapDocument = documents.get(sourceFile.fileName);
        if (!spanMapDocument) {
            const doc = new SvelteTsSourceFileDocument(sourceFile);
            documents.set(sourceFile.fileName, doc);
            spanMapDocument = doc;
        }

        const start = spanMapDocument.originPositionAt(originRange.range.pos);
        const end = spanMapDocument.originPositionAt(originRange.range.end);

        return {
            uri,
            range: {
                start,
                end
            }
        };
    }

    private isDeclarationOfSymbol(symbolDeclaration: tsAst.Node[] | undefined, node: tsAst.Node) {
        if (!symbolDeclaration) {
            return false;
        }

        const declaration = getDeclarationFromName(this.tsApiService.astModule, node);
        return symbolDeclaration.some((decl) => decl === declaration);
    }
}
