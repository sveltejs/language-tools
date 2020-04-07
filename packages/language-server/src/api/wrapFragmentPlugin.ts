import {
    HoverProvider,
    Position,
    Hover,
    FragmentPredicate,
    CompletionsProvider,
    CompletionItem,
    DiagnosticsProvider,
    Diagnostic,
    FormattingProvider,
    TextEdit,
    TextDocumentItem,
    DocumentColorsProvider,
    ColorInformation,
    ColorPresentationsProvider,
    ColorPresentation,
    DocumentSymbolsProvider,
    SymbolInformation,
    DefinitionsProvider,
    CodeActionsProvider,
    CompletionList,
} from './interfaces';
import { Document } from './Document';
import {
    mapHoverToParent,
    mapCompletionItemToParent,
    mapDiagnosticToParent,
    mapTextEditToParent,
    mapColorInformationToParent,
    mapRangeToFragment,
    mapColorPresentationToParent,
    mapSymbolInformationToParent,
    mapLocationLinkToParent,
    mapDiagnosticToFragment,
    mapCodeActionToParent,
} from './fragmentPositions';
import { Host, OnRegister } from './Host';

export function wrapFragmentPlugin<P>(plugin: P, fragmentPredicate: FragmentPredicate): P {
    function getFragment(document: Document) {
        return document.findFragment(fragmentPredicate);
    }

    if (OnRegister.is(plugin)) {
        const onRegister: OnRegister['onRegister'] = plugin.onRegister.bind(plugin);
        plugin.onRegister = function(host) {
            onRegister(<Host>{
                on(name: string, listener: (...args: any[]) => void): void {
                    if (!name.startsWith('document')) {
                        host.on(name, listener);
                        return;
                    }

                    host.on(name, (document: Document, ...args: any[]) => {
                        const fragment = getFragment(document);
                        if (!fragment) {
                            return;
                        }

                        listener(fragment, ...args);
                    });
                },

                openDocument: (document: TextDocumentItem) => host.openDocument(document),
                lockDocument: (uri: string) => host.lockDocument(uri),
                getConfig: (key: string) => host.getConfig(key),
            });
        };
    }

    if (DiagnosticsProvider.is(plugin)) {
        const getDiagnostics: DiagnosticsProvider['getDiagnostics'] = plugin.getDiagnostics.bind(
            plugin,
        );
        plugin.getDiagnostics = async function(document: Document): Promise<Diagnostic[]> {
            const fragment = getFragment(document);
            if (!fragment) {
                return [];
            }

            const items = await getDiagnostics(fragment);
            return items.map(item => mapDiagnosticToParent(fragment, item));
        };
    }

    if (HoverProvider.is(plugin)) {
        const doHover: HoverProvider['doHover'] = plugin.doHover.bind(plugin);
        plugin.doHover = async function(
            document: Document,
            position: Position,
        ): Promise<Hover | null> {
            const fragment = getFragment(document);
            if (!fragment || !fragment.isInFragment(position)) {
                return null;
            }

            const hover = await doHover(fragment, fragment.positionInFragment(position));
            if (!hover) {
                return null;
            }

            return mapHoverToParent(fragment, hover);
        };
    }

    if (CompletionsProvider.is(plugin)) {
        const getCompletions: CompletionsProvider['getCompletions'] = plugin.getCompletions.bind(
            plugin,
        );
        plugin.getCompletions = async function(document, position, triggerCharacter?) {
            const fragment = getFragment(document);
            if (!fragment || !fragment.isInFragment(position)) {
                return null;
            }

            const completions = await getCompletions(
                fragment,
                fragment.positionInFragment(position),
                triggerCharacter,
            );
            if (!completions) {
                return null;
            }

            return CompletionList.create(
                completions.items.map(item => mapCompletionItemToParent(fragment, item)),
                !!completions.isIncomplete,
            );
        };
    }

    if (FormattingProvider.is(plugin)) {
        const formatDocument: FormattingProvider['formatDocument'] = plugin.formatDocument.bind(
            plugin,
        );
        plugin.formatDocument = async function(document: Document): Promise<TextEdit[]> {
            const fragment = getFragment(document);
            if (!fragment) {
                return [];
            }

            const items = await formatDocument(fragment);
            return items.map(item => mapTextEditToParent(fragment, item));
        };
    }

    if (DocumentColorsProvider.is(plugin)) {
        const getDocumentColors: DocumentColorsProvider['getDocumentColors'] = plugin.getDocumentColors.bind(
            plugin,
        );
        plugin.getDocumentColors = async function(document: Document): Promise<ColorInformation[]> {
            const fragment = getFragment(document);
            if (!fragment) {
                return [];
            }

            const items = await getDocumentColors(fragment);
            return items.map(item => mapColorInformationToParent(fragment, item));
        };
    }

    if (ColorPresentationsProvider.is(plugin)) {
        const getColorPresentations: ColorPresentationsProvider['getColorPresentations'] = plugin.getColorPresentations.bind(
            plugin,
        );
        plugin.getColorPresentations = async function(
            document,
            range,
            color,
        ): Promise<ColorPresentation[]> {
            const fragment = getFragment(document);
            if (!fragment) {
                return [];
            }

            const items = await getColorPresentations(
                fragment,
                mapRangeToFragment(fragment, range),
                color,
            );
            return items.map(item => mapColorPresentationToParent(fragment, item));
        };
    }

    if (DocumentSymbolsProvider.is(plugin)) {
        const getDocumentSymbols: DocumentSymbolsProvider['getDocumentSymbols'] = plugin.getDocumentSymbols.bind(
            plugin,
        );
        plugin.getDocumentSymbols = async function(
            document: Document,
        ): Promise<SymbolInformation[]> {
            const fragment = getFragment(document);
            if (!fragment) {
                return [];
            }

            const items = await getDocumentSymbols(fragment);
            return items.map(item => mapSymbolInformationToParent(fragment, item));
        };
    }

    if (DefinitionsProvider.is(plugin)) {
        const getDefinitions: DefinitionsProvider['getDefinitions'] = plugin.getDefinitions.bind(
            plugin,
        );
        plugin.getDefinitions = async function(document, position) {
            const fragment = getFragment(document);
            if (!fragment || !fragment.isInFragment(position)) {
                return [];
            }

            const items = await getDefinitions(fragment, fragment.positionInFragment(position));
            return items.map(item => mapLocationLinkToParent(fragment, item));
        };
    }

    if (CodeActionsProvider.is(plugin)) {
        const getCodeActions: CodeActionsProvider['getCodeActions'] = plugin.getCodeActions.bind(
            plugin,
        );
        plugin.getCodeActions = async function(document, range, context) {
            const fragment = getFragment(document);
            if (
                !fragment ||
                !fragment.isInFragment(range.start) ||
                !fragment.isInFragment(range.end)
            ) {
                return [];
            }

            const items = await getCodeActions(fragment, mapRangeToFragment(fragment, range), {
                ...context,
                diagnostics: context.diagnostics.map(diag =>
                    mapDiagnosticToFragment(fragment, diag),
                ),
            });
            return items.map(item => mapCodeActionToParent(fragment, item));
        };
    }

    return plugin;
}
