import { createConnection, createServer, createTypeScriptProject, loadTsdkByPath } from '@volar/language-server/node';
import { create as createCssScriptServicePlugin } from 'volar-service-css';
import { create as createHtmlServicePlugin } from 'volar-service-html';
import { create as createTypeScriptServicePlugins } from 'volar-service-typescript';
import { svelteLanguagePlugin } from './languagePlugin';

const connection = createConnection();
const server = createServer(connection);

connection.listen();

connection.onInitialize(params => {
    const tsdk = loadTsdkByPath(params.initializationOptions.typescript.tsdk, params.locale);
    return server.initialize(
        params,
        createTypeScriptProject(tsdk.typescript, undefined, () => [svelteLanguagePlugin]),
        [
            createCssScriptServicePlugin(),
            createHtmlServicePlugin(),
            ...createTypeScriptServicePlugins(tsdk.typescript, tsdk.diagnosticMessages),
        ]
    );
});

connection.onInitialized(() => {
    server.initialized();
    server.watchFiles(['**/*.{js,cjs,mjs,ts,cts,mts,jsx,tsx,json,svelte}'])
});

connection.onShutdown(() => {
    server.shutdown();
});
