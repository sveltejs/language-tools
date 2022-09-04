import * as path from 'path';
import { commands, ExtensionContext, ProgressLocation, Uri, window, workspace } from 'vscode';
import { commandsMap } from './commands';
import { generateResources } from './generate';
import { resourcesMap } from './resources';
import { FileType, ICommand, Resource, ResourceType, TemplateConfig } from './types';
import { findFile } from './utils';

export function addGenerateKitFilesCommand(context: ExtensionContext) {
    const showDynamicDialog = async (uri: Uri | undefined, command: ICommand) => {
        let rootPath!: string;
        if (uri) {
            rootPath = uri.fsPath;
        } else if (window.activeTextEditor) {
            rootPath = path.dirname(window.activeTextEditor.document.fileName);
        } else if (workspace.workspaceFolders && workspace.workspaceFolders.length === 1) {
            rootPath = workspace.workspaceFolders[0].uri.fsPath;
        }
        if (!rootPath) {
            await window.showErrorMessage(
                'Could not resolve root path. Please open a file first or use the context menu!'
            );
            return;
        }

        const isTs = !!(await findFile(rootPath, 'tsconfig.json'));
        const scriptExtension = isTs ? 'ts' : 'js';

        let resources: Resource[] = [];

        // Add a single file
        if (command.resources.length > 0) {
            command.resources.forEach((type) => {
                const resource = resourcesMap.get(type);
                if (resource) {
                    resources.push(resource);
                }
            });
        }

        // Add multiple files
        if (!resources?.length) {
            const opts = [
                ResourceType.PAGE,
                ResourceType.PAGE_LOAD,
                ResourceType.PAGE_SERVER,
                ResourceType.LAYOUT,
                ResourceType.LAYOUT_LOAD,
                ResourceType.LAYOUT_SERVER,
                ResourceType.ERROR
            ].map((type) => {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const resource = resourcesMap.get(type)!;
                // const iconName = resource.type === FileType.PAGE ? 'svelte' : isTs ? 'typescript' : 'javascript';
                const extension = resource.type === FileType.PAGE ? 'svelte' : scriptExtension;
                return {
                    label: resource.title,
                    // TODO: maybe add icons (ts,js,svelte - but it doesn´t work like this)
                    // description: `$(${iconName}) ${resource.filename}.${extension}`,
                    description: `${resource.filename}.${extension}`,
                    value: resource
                };
            });

            const result = await window.showQuickPick(opts, { canPickMany: true });

            if (!result) {
                return;
            }

            resources = result.map((res) => res.value);
        }

        const itemPath = await window.showInputBox({
            prompt: `Type the path of the new ${resources.length === 1 ? resources[0] : 'files'}`,
            value: '/'
        });

        if (!itemPath) {
            throw new Error('Please enter a path');
        }

        const fullPath = path.join(rootPath, itemPath);

        const config: TemplateConfig = {
            path: fullPath,
            typescript: isTs,
            resources,
            pageExtension: 'svelte',
            scriptExtension
        };

        await window.withProgress(
            { location: ProgressLocation.Window, title: 'Creating SvelteKit files...' },
            async () => {
                await generateResources(config);
            }
        );
    };

    commandsMap.forEach((value, key) => {
        const command = commands.registerCommand(key, (args) => {
            showDynamicDialog(args, value);
        });
        context.subscriptions.push(command);
    });
}
