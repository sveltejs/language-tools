import {
    HoverProvider,
    Position,
    Hover,
    FragmentPredicate,
    CompletionsProvider,
    CompletionItem,
    DiagnosticsProvider,
    Diagnostic,
} from './interfaces';
import { Document } from './Document';
import {
    mapHoverToParent,
    mapCompletionItemToParent,
    mapDiagnosticToParent,
} from './fragmentPositions';
import { Host } from './Host';

export function wrapFragmentPlugin<P>(plugin: P, fragmentPredicate: FragmentPredicate): P {
    function getFragment(document: Document) {
        return document.findFragment(fragmentPredicate);
    }

    if (hasOnRegister(plugin)) {
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
        plugin.getCompletions = async function(
            document: Document,
            position: Position,
        ): Promise<CompletionItem[]> {
            const fragment = getFragment(document);
            if (!fragment || !fragment.isInFragment(position)) {
                return [];
            }

            const items = await getCompletions(fragment, fragment.positionInFragment(position));
            return items.map(item => mapCompletionItemToParent(fragment, item));
        };
    }

    return plugin;
}

interface OnRegister {
    onRegister(host: Host): void;
}

function hasOnRegister(plugin: any): plugin is OnRegister {
    return typeof plugin.onRegister === 'function';
}
