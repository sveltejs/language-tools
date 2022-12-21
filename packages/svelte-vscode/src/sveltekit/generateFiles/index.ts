import * as path from 'path';
import { commands, ExtensionContext, ProgressLocation, Uri, window, workspace } from 'vscode';
import { addResourceCommandMap } from './commands';
import { generateResources } from './generate';
import { resourcesMap } from './resources';
import { FileType, ResourceType, GenerateConfig, CommandType } from './types';
import { checkProjectType } from '../utils';

class GenerateError extends Error {}

export function addGenerateKitRouteFilesCommand(context: ExtensionContext) {
    addResourceCommandMap.forEach((value, key) => {
        context.subscriptions.push(
            commands.registerCommand(key, (args) => {
                handleSingle(args, value).catch(handleError);
            })
        );
    });
    context.subscriptions.push(
        commands.registerCommand(CommandType.MULTIPLE, async (args) => {
            handleMultiple(args).catch(handleError);
        })
    );
}

async function handleError(err: unknown) {
    if (err instanceof GenerateError) {
        await window.showErrorMessage(err.message);
    } else {
        throw err;
    }
}

async function handleSingle(uri: Uri | undefined, resourceType: ResourceType) {
    const resource = resourcesMap.get(resourceType);
    if (!resource) {
        throw new GenerateError(`Resource '${resourceType}' does not exist`);
    }
    const resources = [resource];

    const { type, rootPath, scriptExtension } = await getCommonConfig(uri);

    const itemPath = await promptResourcePath();

    if (!itemPath) {
        return;
    }

    await generate({
        path: path.join(rootPath, itemPath),
        type,
        pageExtension: 'svelte',
        scriptExtension,
        resources
    });
}

async function handleMultiple(uri: Uri | undefined) {
    const { type, rootPath, scriptExtension } = await getCommonConfig(uri);
    const itemPath = await promptResourcePath();

    if (!itemPath) {
        return;
    }

    // Add multiple files
    const opts = [
        ResourceType.PAGE,
        ResourceType.PAGE_LOAD,
        ResourceType.PAGE_SERVER,
        ResourceType.LAYOUT,
        ResourceType.LAYOUT_LOAD,
        ResourceType.LAYOUT_SERVER,
        ResourceType.ERROR,
        ResourceType.SERVER
    ].map((type) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const resource = resourcesMap.get(type)!;
        // const iconName = resource.type === FileType.PAGE ? 'svelte' : isTs ? 'typescript' : 'javascript';
        const extension = resource.type === FileType.PAGE ? 'svelte' : scriptExtension;
        return {
            // TODO: maybe add icons (ts,js,svelte - but it doesn´t work like this)
            // description: `$(${iconName}) ${resource.filename}.${extension}`,
            label: `${resource.filename}.${extension}`,
            value: resource
        };
    });
    const result = await window.showQuickPick(opts, { canPickMany: true });

    if (!result) {
        return;
    }

    await generate({
        path: path.join(rootPath, itemPath),
        type,
        pageExtension: 'svelte',
        scriptExtension,
        resources: result.map((res) => res.value)
    });
}

async function promptResourcePath() {
    const itemPath = await window.showInputBox({
        prompt: 'Enter the path of the resources, relative to current folder',
        value: '/'
    });

    return itemPath;
}

async function generate(config: GenerateConfig) {
    await window.withProgress(
        { location: ProgressLocation.Window, title: 'Creating SvelteKit files...' },
        async () => {
            await generateResources(config);
        }
    );
}

async function getCommonConfig(uri: Uri | undefined) {
    const rootPath = getRootPath(uri);
    if (!rootPath) {
        throw new GenerateError(
            'Could not resolve root path. Please open a file first or use the context menu!'
        );
    }

    const type = await checkProjectType(rootPath);
    const scriptExtension = type === 'js' ? 'js' : 'ts';
    return {
        type,
        scriptExtension,
        rootPath
    } as const;
}

function getRootPath(uri: Uri | undefined) {
    let rootPath!: string;
    if (uri) {
        rootPath = uri.fsPath;
    } else if (window.activeTextEditor) {
        rootPath = path.dirname(window.activeTextEditor.document.fileName);
    } else if (workspace.workspaceFolders && workspace.workspaceFolders.length === 1) {
        rootPath = workspace.workspaceFolders[0].uri.fsPath;
    }
    return rootPath;
}
