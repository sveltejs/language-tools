import * as protocol from '@volar/language-server/protocol';
import { BaseLanguageClient, createLabsInfo, activateTsConfigStatusItem, activateTsVersionStatusItem } from '@volar/vscode';
import * as lsp from '@volar/vscode/node';
import * as path from 'path';
import * as vscode from 'vscode';

let client: BaseLanguageClient;

export async function activate(context: vscode.ExtensionContext) {

    // Patch TypeScript extension to support Svelte files
    patchTypeScriptExtension();

    const documentSelector: lsp.DocumentSelector = [{ language: 'svelte' }];
    const serverModule = vscode.Uri.joinPath(context.extensionUri, 'dist', 'server.js');
    const runOptions = { execArgv: <string[]>[] };
    const debugOptions = { execArgv: ['--nolazy', '--inspect=' + 6009] };
    const serverOptions: lsp.ServerOptions = {
        run: {
            module: serverModule.fsPath,
            transport: lsp.TransportKind.ipc,
            options: runOptions
        },
        debug: {
            module: serverModule.fsPath,
            transport: lsp.TransportKind.ipc,
            options: debugOptions
        },
    };
    const clientOptions: lsp.LanguageClientOptions = {
        documentSelector,
        initializationOptions: {
            typescript: {
                tsdk: path.join(
                    vscode.env.appRoot,
                    'extensions/node_modules/typescript/lib',
                ),
            },
        },
    };
    client = new lsp.LanguageClient(
        'svelte-language-server',
        'Svelte Language Server',
        serverOptions,
        clientOptions,
    );
    await client.start();

    activateTsConfigStatusItem('svelte', 'svelte.tsConfigStatus', client);
    activateTsVersionStatusItem('svelte', 'svelte.tsVersionStatus', context, text => text);

    const labsInfo = createLabsInfo(protocol);
    labsInfo.addLanguageClient(client);

    // support https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volarjs-labs
    return labsInfo.extensionExports;
}

export function deactivate(): Thenable<any> | undefined {
    return client?.stop();
}

/**
 * Patch the built-in TypeScript extension to recognize .svelte files.
 * This hack intercepts fs.readFileSync to modify the TypeScript extension's
 * JavaScript code at load time, adding "svelte" to the list of supported languages.
 * 
 * This enables features like:
 * - Auto imports from .svelte files in .ts/.js files
 * - Go to definition from .ts/.js to .svelte files
 * - TypeScript plugin integration
 * 
 * This approach has been battle-tested in Vue Language Tools.
 */
function patchTypeScriptExtension(): boolean {
    const tsExtension = vscode.extensions.getExtension('vscode.typescript-language-features');
    if (!tsExtension) {
        return false;
    }
    if (tsExtension.isActive) {
        // TypeScript extension already activated, too late to patch
        return false;
    }

    const fs = require('node:fs') as typeof import('fs');
    const readFileSync = fs.readFileSync;
    const extensionJsPath = require.resolve('./dist/extension.js', { paths: [tsExtension.extensionPath] });
    
    // Get Svelte extension info
    const { publisher, name } = require('../package.json');
    const svelteExtension = vscode.extensions.getExtension(`${publisher}.${name}`);
    if (!svelteExtension) {
        return false;
    }
    
    const tsPluginName = 'typescript-svelte-plugin-bundled';

    // Update the typescriptServerPlugins contribution
    svelteExtension.packageJSON.contributes.typescriptServerPlugins = [
        {
            name: tsPluginName,
            enableForWorkspaceTypeScriptVersions: true,
            configNamespace: 'typescript',
            languages: ['svelte'],
        },
    ];

    // Intercept fs.readFileSync to patch the TypeScript extension
    (fs as any).readFileSync = (...args: Parameters<typeof readFileSync>): ReturnType<typeof readFileSync> => {
        if (args[0] === extensionJsPath) {
            let text = readFileSync(...args) as string;
            
            // patch jsTsLanguageModes - add svelte to the list of JS/TS language modes
            text = text.replace(
                't.jsTsLanguageModes=[t.javascript,t.javascriptreact,t.typescript,t.typescriptreact]',
                s => s + '.concat("svelte")',
            );
            
            // patch isSupportedLanguageMode - allow svelte files to be recognized
            text = text.replace(
                '.languages.match([t.typescript,t.typescriptreact,t.javascript,t.javascriptreact]',
                s => s + '.concat("svelte")',
            );
            
            // patch isTypeScriptDocument - treat svelte as TypeScript for type checking
            text = text.replace(
                '.languages.match([t.typescript,t.typescriptreact]',
                s => s + '.concat("svelte")',
            );
            
            // sort plugins to ensure svelte plugin loads first (for compatibility with other plugins)
            text = text.replace(
                '"--globalPlugins",i.plugins',
                s => s + `.sort((a,b)=>(b.name==="${tsPluginName}"?-1:0)-(a.name==="${tsPluginName}"?-1:0))`,
            );
            
            return text;
        }
        return readFileSync(...args);
    };

    // If the module was already loaded, reload it with patches
    const loadedModule = require.cache[extensionJsPath];
    if (loadedModule) {
        delete require.cache[extensionJsPath];
        const patchedModule = require(extensionJsPath);
        Object.assign(loadedModule.exports, patchedModule);
    }

    return true;
}
