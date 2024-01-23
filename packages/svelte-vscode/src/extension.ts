import type { InitializationOptions } from '@volar/language-server';
import * as protocol from '@volar/language-server/protocol';
import { BaseLanguageClient, createLabsInfo } from '@volar/vscode';
import * as lsp from '@volar/vscode/node';
import * as path from 'path';
import * as vscode from 'vscode';

let client: BaseLanguageClient;

export async function activate(context: vscode.ExtensionContext) {
	vscode.extensions.getExtension('vscode.typescript-language-features')?.activate()

	const documentSelector: lsp.DocumentSelector = [{ language: 'svelte' }];
	const initializationOptions: InitializationOptions = {
		typescript: {
			tsdk: path.join(
				vscode.env.appRoot,
				'extensions/node_modules/typescript/lib',
			),
		},
	};
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
		initializationOptions,
	};
	client = new lsp.LanguageClient(
		'svelte-language-server',
		'Svelte Language Server',
		serverOptions,
		clientOptions,
	);
	await client.start();

	const labsInfo = createLabsInfo(protocol);
	labsInfo.addLanguageClient(client);

	// support https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volarjs-labs
	return labsInfo.extensionExports;
}

export function deactivate(): Thenable<any> | undefined {
	return client?.stop();
}

// Track https://github.com/microsoft/vscode/issues/200511
try {
	const tsExtension = vscode.extensions.getExtension('vscode.typescript-language-features');
	if (tsExtension) {
		const readFileSync = require('fs').readFileSync;
		const extensionJsPath = require.resolve('./dist/extension.js', { paths: [tsExtension.extensionPath] });

		// @ts-expect-error
		require('fs').readFileSync = (...args) => {
			if (args[0] === extensionJsPath) {
				let text = readFileSync(...args) as string;

				// patch jsTsLanguageModes
				text = text.replace('t.$u=[t.$r,t.$s,t.$p,t.$q]', s => s + '.concat("svelte")');

				// patch isSupportedLanguageMode
				text = text.replace('s.languages.match([t.$p,t.$q,t.$r,t.$s]', s => s + '.concat("svelte")');

				return text;
			}
			return readFileSync(...args);
		};
	}
} catch { }
