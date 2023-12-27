import type { InitializationOptions } from '@volar/language-server';
import * as protocol from '@volar/language-server/protocol';
import { BaseLanguageClient, createLabsInfo, activateTsConfigStatusItem, activateTsVersionStatusItem } from '@volar/vscode';
import * as lsp from '@volar/vscode/node';
import * as path from 'path';
import * as vscode from 'vscode';

let client: BaseLanguageClient;

export async function activate(context: vscode.ExtensionContext) {

	const documentSelector: lsp.DocumentSelector = [{ language: 'svelte' }];
	const initializationOptions: InitializationOptions = {
		typescript: {
			tsdk: path.join(
				vscode.env.appRoot,
				'extensions/node_modules/typescript/lib',
			),
		},
	};
	const serverModule = vscode.Uri.joinPath(context.extensionUri, 'node_modules', 'svelte-language-server', 'bin', 'server.js');
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
		initializationOptions,
	};
	client = new lsp.LanguageClient(
		'svelte-language-server',
		'Svelte Language Server',
		serverOptions,
		clientOptions,
	);
	await client.start();

	activateTsConfigStatusItem('svelte', 'svelte.tsConfigStatus', client);
	activateTsVersionStatusItem('svelte', 'svelte.tsVersionStatus', context, client, text => text);

	const labsInfo = createLabsInfo(protocol);
	labsInfo.addLanguageClient(client);

	// support https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volarjs-labs
	return labsInfo.extensionExports;
}

export function deactivate(): Thenable<any> | undefined {
	return client?.stop();
}
