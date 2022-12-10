import { TextDecoder } from 'util';
import { ExtensionContext, commands, workspace } from 'vscode';
import { addGenerateKitRouteFilesCommand } from './generateFiles';

type ShowSvelteKitFilesCommandConfig = 'auto' | 'on' | 'off';

export function setupSvelteKit(context: ExtensionContext) {
    let contextMenuEnabled = false;
    context.subscriptions.push(
        workspace.onDidChangeConfiguration(() => {
            enableContextMenu();
        })
    );

    addGenerateKitRouteFilesCommand(context);
    enableContextMenu();

    async function enableContextMenu() {
        const config = getConfig();
        if (config === 'off') {
            if (contextMenuEnabled) {
                setEnableContext(false);
            }
            return;
        }

        if (config === 'on') {
            // force on
            return;
        }

        if (await detect()) {
            setEnableContext(true);
            contextMenuEnabled = true;
        }
    }
}

function getConfig() {
    return (
        workspace
            .getConfiguration('svelte.ui')
            .get<ShowSvelteKitFilesCommandConfig>('showSvelteKitFilesCommand') ?? 'auto'
    );
}

async function detect() {
    const packageJsonList = await workspace.findFiles('**/package.json', 'node_modules');

    for (const fileUri of packageJsonList) {
        try {
            const text = new TextDecoder().decode(await workspace.fs.readFile(fileUri));
            const pkg = JSON.parse(text);
            const hasKit = Object.keys(pkg.devDependencies ?? {})
                .concat(Object.keys(pkg.dependencies ?? {}))
                .includes('@sveltejs/kit');

            if (hasKit) {
                return true;
            }
        } catch (error) {
            console.error(error);
        }
    }

    return false;
}

function setEnableContext(enable: boolean) {
    commands.executeCommand('setContext', 'svelte.uiContext.showSvelteKitFilesCommand', enable);
}
