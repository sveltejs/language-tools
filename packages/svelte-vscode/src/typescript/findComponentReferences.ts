import {
    commands,
    ExtensionContext,
    ProgressLocation,
    Uri,
    window,
    workspace,
    Position,
    Location,
    Range
} from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { Location as LSLocation } from 'vscode-languageclient';

export async function addFindComponentReferencesListener(
    getLS: () => LanguageClient,
    context: ExtensionContext
) {
    const disposable = commands.registerCommand(
        'svelte.typescript.findComponentReferences',
        handler
    );

    context.subscriptions.push(disposable);

    async function handler(resource?: Uri) {
        if (!resource) {
            resource = window.activeTextEditor?.document.uri;
        }

        if (!resource || resource.scheme !== 'file') {
            return;
        }

        const document = await workspace.openTextDocument(resource);

        await window.withProgress(
            {
                location: ProgressLocation.Window,
                title: 'Finding component references'
            },
            async (_, token) => {
                const lsLocations = await getLS().sendRequest<LSLocation[] | null>(
                    '$/getComponentReferences',
                    document.uri.toString(),
                    token
                );

                if (!lsLocations) {
                    return;
                }

                await commands.executeCommand(
                    'editor.action.showReferences',
                    resource,
                    new Position(0, 0),
                    lsLocations.map(
                        (ref) =>
                            new Location(
                                Uri.parse(ref.uri),
                                new Range(
                                    ref.range.start.line,
                                    ref.range.start.character,
                                    ref.range.end.line,
                                    ref.range.end.character
                                )
                            )
                    )
                );
            }
        );
    }
}
