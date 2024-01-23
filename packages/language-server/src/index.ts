import { createConnection, createServer, createTypeScriptProjectProvider } from '@volar/language-server/node';
import { create as createCssScriptServicePlugin } from 'volar-service-css';
import { create as createHtmlServicePlugin } from 'volar-service-html';
import { create as createTypeScriptServicePlugin } from 'volar-service-typescript';
import { svelteLanguagePlugin } from './languagePlugin';

const connection = createConnection();
const server = createServer(connection);

connection.listen();

connection.onInitialize(params => {
	return server.initialize(params, createTypeScriptProjectProvider, {
		watchFileExtensions: ['js', 'cjs', 'mjs', 'ts', 'cts', 'mts', 'jsx', 'tsx', 'json', 'svelte'],
		getServicePlugins() {
			return [
				createCssScriptServicePlugin(),
				createHtmlServicePlugin(),
				createTypeScriptServicePlugin(server.modules.typescript!),
			]
		},
		getLanguagePlugins() {
			return [svelteLanguagePlugin];
		},
	});
});

connection.onInitialized(() => {
	server.initialized();
});

connection.onShutdown(() => {
	server.shutdown();
});
