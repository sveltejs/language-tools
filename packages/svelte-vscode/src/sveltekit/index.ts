import { TextDecoder } from 'util';
import { ExtensionContext, commands, workspace } from 'vscode';
import { addGenerateKitRouteFilesCommand } from './generateFiles';

type ShowSvelteKitFilesContextMenuConfig = 'auto' | 'always' | 'never';

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
        if (config === 'never') {
            if (contextMenuEnabled) {
                setEnableContext(false);
            }
            return;
        }

        if (config === 'always') {
            // Force on. The condition is defined in the extension manifest
            return;
        }

        const enabled = await detect(20);
        if (enabled !== contextMenuEnabled) {
            setEnableContext(enabled);
            contextMenuEnabled = enabled;
        }
    }
}

function getConfig() {
    return (
        workspace
            .getConfiguration('svelte.ui.svelteKitFilesContextMenu')
            .get<ShowSvelteKitFilesContextMenuConfig>('enable') ?? 'auto'
    );
}

async function detect(nrRetries: number): Promise<boolean> {
    const packageJsonList = await workspace.findFiles('**/package.json', '**/node_modules/**');

    if (packageJsonList.length === 0 && nrRetries > 0) {
        // We assume that the user has not setup their project yet, so try again after a while
        await new Promise((resolve) => setTimeout(resolve, 10000));
        return detect(nrRetries - 1);
    }

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
    // https://code.visualstudio.com/api/references/when-clause-contexts#add-a-custom-when-clause-context
    commands.executeCommand(
        'setContext',
        'svelte.uiContext.svelteKitFilesContextMenu.enable',
        enable
    );
}
