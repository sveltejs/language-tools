import { TsApiService } from '../TsApiService';
import { FindComponentReferencesProvider } from '../../interfaces';
import { Location } from 'vscode-languageserver-types';
import { tsApiAsync, tsAst } from '../types';
import { isNotNullOrUndefined } from '../../../utils';
import { CancellationToken } from 'vscode-languageserver-protocol';
import { getDeclarationFromName, waitWithCancellation } from './utils';
import { TsApiLocationMapper } from '../TsApiLocationMapper';

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
        const result = await this.tsApiService.withSourceFile(uri, async (project, file) => {
            if (options.cancellationToken?.isCancellationRequested) {
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
            const mapper = new TsApiLocationMapper(this.tsApiService.astModule);
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
                        this.toLocation(ref, symbolDeclarations, mapper, options.includeDeclaration)
                    );
                }
            }

            const locations = await waitWithCancellation(
                locationPromises,
                options.cancellationToken
            );
            return locations.filter(isNotNullOrUndefined);
        });
        return result ?? null;
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
        mapper: TsApiLocationMapper,
        includeDeclaration: boolean
    ): Promise<Location | null> {
        const node = await nodeHandle.resolve();
        if (!node) {
            return null;
        }
        if (!includeDeclaration && this.isDeclarationOfSymbol(symbolDeclaration, node)) {
            return null;
        }

        // Undefined for references in generated code (e.g. svelte2tsx's hidden helpers), which
        // otherwise map to an insertion point with "none" fidelity
        const location = mapper.toOriginalLocation(
            node,
            this.tsApiService.astModule.SpanMapFeature.References
        );
        const sourceFile = node.getSourceFile();
        if (!location || !sourceFile) {
            return null;
        }

        if (sourceFile.spanMap) {
            // svelte2tsx anchors the default export at the start of the file (go-to-definition)
            const isComponentDef = location.start === 0;
            if (isComponentDef) {
                return null;
            }

            // Only report start tags. Check the original text: `location.start` is an offset
            // there, `node.getStart()` one in the virtual code
            const originalText = sourceFile.originalText;
            const isEndTag =
                originalText.charCodeAt(location.start - 1) === 47 /* '/' */ &&
                originalText.charCodeAt(location.start - 2) === 60; /* '<' */
            if (isEndTag) {
                return null;
            }
        }

        return { uri: location.uri, range: location.range };
    }

    private isDeclarationOfSymbol(symbolDeclaration: tsAst.Node[] | undefined, node: tsAst.Node) {
        if (!symbolDeclaration) {
            return false;
        }

        const declaration = getDeclarationFromName(this.tsApiService.astModule, node);
        return symbolDeclaration.some((decl) => decl === declaration);
    }
}
