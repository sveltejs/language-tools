import {
    commands,
    ExtensionContext,
    ProgressLocation,
    Uri,
    window,
    workspace,
    Position
} from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { Location as LSLocation } from 'vscode-languageclient';

/**
 * adopted from https://github.com/microsoft/vscode/blob/5f3e9c120a4407de3e55465588ce788618526eb0/extensions/typescript-language-features/src/languageFeatures/fileReferences.ts
 */
export async function addFindFileReferencesListener(
    getLS: () => LanguageClient,
    context: ExtensionContext
) {
    const disposable = commands.registerCommand('svelte.typescript.findAllFileReferences', handler);

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
                title: 'Finding file references'
            },
            async (_, token) => {
                const locations = await getLS().sendRequest<LSLocation[] | null>(
                    '$/getFileReferences',
                    { uri: document.uri.toString() },
                    token
                );

                const config = workspace.getConfiguration('references');
                const existingSetting = config.inspect<string>('preferredLocation');

                await config.update('preferredLocation', 'view');
                try {
                    await commands.executeCommand(
                        'editor.action.showReferences',
                        resource,
                        new Position(0, 0),
                        locations
                    );
                } finally {
                    await config.update(
                        'preferredLocation',
                        existingSetting?.workspaceFolderValue ?? existingSetting?.workspaceValue
                    );
                }
            }
        );
    }
}
