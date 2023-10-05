import ts from 'typescript';
import { CancellationToken, CodeLens, Range } from 'vscode-languageserver';
import { Document, mapRangeToOriginal } from '../../../lib/documents';
import { LSConfigManager, TSUserConfig } from '../../../ls-config';
import { CodeLensProvider, FindReferencesProvider, ImplementationProvider } from '../../interfaces';
import { SvelteDocumentSnapshot } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertRange, isGeneratedSvelteComponentName } from '../utils';

type CodeLensType = 'reference' | 'implementation';

interface CodeLensCollector {
    type: CodeLensType;
    collect: (
        tsDoc: SvelteDocumentSnapshot,
        item: ts.NavigationTree,
        parent: ts.NavigationTree | undefined
    ) => Range | undefined;
}

export class CodeLensProviderImpl implements CodeLensProvider {
    constructor(
        private readonly lsAndTsDocResolver: LSAndTSDocResolver,
        private readonly referenceProvider: FindReferencesProvider,
        private readonly implementationProvider: ImplementationProvider,
        private readonly configManager: LSConfigManager
    ) {}

    async getCodeLens(document: Document): Promise<CodeLens[] | null> {
        const { lang, tsDoc } = await this.lsAndTsDocResolver.getLsForSyntheticOperations(document);

        const results: [CodeLensType, Range][] = [];
        const navigationTree = lang.getNavigationTree(tsDoc.filePath);

        const collectors: CodeLensCollector[] = [];

        const vscodeTsConfig = this.configManager.getRawTsUserConfig(
            tsDoc.scriptKind === ts.ScriptKind.TS ? 'typescript' : 'javascript'
        );

        if (vscodeTsConfig.referencesCodeLens?.enabled) {
            collectors.push({
                type: 'reference',
                collect: (tsDoc, item, parent) =>
                    this.extractReferenceLocation(tsDoc, item, parent, vscodeTsConfig)
            });
        }

        if (
            tsDoc.scriptKind === ts.ScriptKind.TS &&
            vscodeTsConfig.implementationCodeLens?.enabled
        ) {
            collectors.push({
                type: 'implementation',
                collect: (tsDoc, item) => this.extractImplementationLocation(tsDoc, item)
            });
        }

        if (!collectors.length) {
            return null;
        }

        const renderFunction = navigationTree?.childItems?.find((item) => item.text === 'render');
        if (renderFunction) {
            // pretty rare that there is anything to show in the template, so we skip it
            const notTemplate = renderFunction.childItems?.filter(
                (item) => item.text !== '<function>'
            );
            renderFunction.childItems = notTemplate;
        }

        this.walkTree(tsDoc, navigationTree, undefined, results, collectors);

        const uri = document.uri;
        return results.map(([type, range]) => CodeLens.create(range, { type, uri }));
    }

    /**
     * https://github.com/microsoft/vscode/blob/062ba1ed6c2b9ff4819f4f7dad76de3fde0044ab/extensions/typescript-language-features/src/languageFeatures/codeLens/referencesCodeLens.ts#L61
     */
    private extractReferenceLocation(
        tsDoc: SvelteDocumentSnapshot,
        item: ts.NavigationTree,
        parent: ts.NavigationTree | undefined,
        config: TSUserConfig
    ): Range | undefined {
        if (parent && parent.kind === ts.ScriptElementKind.enumElement) {
            return this.getSymbolRange(tsDoc, item);
        }

        switch (item.kind) {
            case ts.ScriptElementKind.functionElement: {
                const showOnAllFunctions = config.referencesCodeLens?.showOnAllFunctions;

                if (showOnAllFunctions) {
                    return this.getSymbolRange(tsDoc, item);
                }

                if (this.isExported(item, tsDoc)) {
                    return this.getSymbolRange(tsDoc, item);
                }
                break;
            }

            case ts.ScriptElementKind.constElement:
            case ts.ScriptElementKind.letElement:
            case ts.ScriptElementKind.variableElement:
                // Only show references for exported variables
                if (this.isExported(item, tsDoc)) {
                    return this.getSymbolRange(tsDoc, item);
                }
                break;

            case ts.ScriptElementKind.classElement:
                if (item.text === '<class>') {
                    break;
                }
                return this.getSymbolRange(tsDoc, item);

            case ts.ScriptElementKind.interfaceElement:
            case ts.ScriptElementKind.typeElement:
            case ts.ScriptElementKind.enumElement:
                return this.getSymbolRange(tsDoc, item);

            case ts.ScriptElementKind.memberFunctionElement:
            case ts.ScriptElementKind.memberGetAccessorElement:
            case ts.ScriptElementKind.memberSetAccessorElement:
            case ts.ScriptElementKind.constructorImplementationElement:
            case ts.ScriptElementKind.memberVariableElement:
                if (parent?.spans[0].start === item.spans[0].start) {
                    return undefined;
                }

                // Only show if parent is a class type object (not a literal)
                switch (parent?.kind) {
                    case ts.ScriptElementKind.classElement:
                    case ts.ScriptElementKind.interfaceElement:
                    case ts.ScriptElementKind.typeElement:
                        return this.getSymbolRange(tsDoc, item);
                }
                break;
        }

        return undefined;
    }

    private isExported(item: ts.NavigationTree, tsDoc: SvelteDocumentSnapshot): boolean {
        return !tsDoc.parserError && item.kindModifiers.match(/\bexport\b/g) !== null;
    }

    /**
     * https://github.com/microsoft/vscode/blob/062ba1ed6c2b9ff4819f4f7dad76de3fde0044ab/extensions/typescript-language-features/src/languageFeatures/codeLens/implementationsCodeLens.ts#L66
     */
    private extractImplementationLocation(
        tsDoc: SvelteDocumentSnapshot,
        item: ts.NavigationTree
    ): Range | undefined {
        switch (item.kind) {
            case ts.ScriptElementKind.interfaceElement:
                return this.getSymbolRange(tsDoc, item);

            case ts.ScriptElementKind.classElement:
            case ts.ScriptElementKind.memberFunctionElement:
            case ts.ScriptElementKind.memberVariableElement:
            case ts.ScriptElementKind.memberGetAccessorElement:
            case ts.ScriptElementKind.memberSetAccessorElement:
                if (item.kindModifiers.match(/\babstract\b/g)) {
                    return this.getSymbolRange(tsDoc, item);
                }
                break;
        }
        return undefined;
    }

    private getSymbolRange(
        tsDoc: SvelteDocumentSnapshot,
        item: ts.NavigationTree
    ): Range | undefined {
        if (!item.nameSpan) {
            return;
        }

        const range = mapRangeToOriginal(tsDoc, convertRange(tsDoc, item.spans[0]));

        if (range.start.line >= 0 && range.end.line >= 0) {
            return range;
        }

        // only map to the start of file if it's a generated component
        if (isGeneratedSvelteComponentName(item.text)) {
            return {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 0 }
            };
        }
    }

    private walkTree(
        tsDoc: SvelteDocumentSnapshot,
        item: ts.NavigationTree,
        parent: ts.NavigationTree | undefined,
        results: [CodeLensType, Range][],
        collectors: CodeLensCollector[]
    ) {
        for (const collector of collectors) {
            const range = collector.collect(tsDoc, item, parent);
            if (range) {
                results.push([collector.type, range]);
            }
        }

        item.childItems?.forEach((child) => this.walkTree(tsDoc, child, item, results, collectors));
    }

    async resolveCodeLens(
        textDocument: Document,
        codeLensToResolve: CodeLens,
        cancellationToken?: CancellationToken
    ): Promise<CodeLens> {
        if (codeLensToResolve.data.type === 'reference') {
            return await this.resolveReferenceCodeLens(
                textDocument,
                codeLensToResolve,
                cancellationToken
            );
        }

        if (codeLensToResolve.data.type === 'implementation') {
            return await this.resolveImplementationCodeLens(
                textDocument,
                codeLensToResolve,
                cancellationToken
            );
        }

        return codeLensToResolve;
    }

    private async resolveReferenceCodeLens(
        textDocument: Document,
        codeLensToResolve: CodeLens,
        cancellationToken?: CancellationToken
    ) {
        const references =
            (await this.referenceProvider.findReferences(
                textDocument,
                codeLensToResolve.range.start,
                { includeDeclaration: false },
                cancellationToken
            )) ?? [];

        codeLensToResolve.command = {
            title: references.length === 1 ? `1 reference` : `${references.length} references`,
            // language clients need to map this to the corresponding command in each editor
            // see example in svelte-vscode/src/middlewares.ts
            command: '',
            arguments: [textDocument.uri, codeLensToResolve.range.start, references]
        };

        return codeLensToResolve;
    }

    private async resolveImplementationCodeLens(
        textDocument: Document,
        codeLensToResolve: CodeLens,
        cancellationToken?: CancellationToken
    ) {
        const implementations =
            (await this.implementationProvider.getImplementation(
                textDocument,
                codeLensToResolve.range.start,
                cancellationToken
            )) ?? [];

        codeLensToResolve.command = {
            title:
                implementations.length === 1
                    ? `1 implementation`
                    : `${implementations.length} implementations`,
            command: '',
            arguments: [textDocument.uri, codeLensToResolve.range.start, implementations]
        };

        return codeLensToResolve;
    }
}
