import { dirname, resolve } from 'path';
import { decorateLanguageService } from './language-service';
import { Logger } from './logger';
import { patchModuleLoader } from './module-loader';
import { SvelteSnapshotManager } from './svelte-snapshots';
import type ts from 'typescript/lib/tsserverlibrary';

function init(modules: { typescript: typeof ts }) {
    function create(info: ts.server.PluginCreateInfo) {
        const logger = new Logger(info.project.projectService.logger);

        if (!isSvelteProject(info)) {
            logger.log('Detected that this is not a Svelte project, abort patching TypeScript');
            return info.languageService;
        }

        logger.log('Starting Svelte plugin');

        const snapshotManager = new SvelteSnapshotManager(
            modules.typescript,
            info.project.projectService,
            logger
        );

        patchCompilerOptions(info.project);
        patchModuleLoader(
            logger,
            snapshotManager,
            modules.typescript,
            info.languageServiceHost,
            info.project
        );
        return decorateLanguageService(info.languageService, snapshotManager, logger);
    }

    function getExternalFiles(project: ts.server.ConfiguredProject) {
        // Needed so the ambient definitions are known inside the tsx files
        const svelteTsPath = dirname(require.resolve('svelte2tsx'));
        const svelteTsxFiles = [
            './svelte-shims.d.ts',
            './svelte-jsx.d.ts',
            './svelte-native-jsx.d.ts'
        ].map((f) => modules.typescript.sys.resolvePath(resolve(svelteTsPath, f)));
        return svelteTsxFiles;
    }

    function patchCompilerOptions(project: ts.server.Project) {
        const compilerOptions = project.getCompilerOptions();
        // Patch needed because svelte2tsx creates jsx/tsx files
        compilerOptions.jsx = modules.typescript.JsxEmit.Preserve;

        // detect which JSX namespace to use (svelte | svelteNative) if not specified or not compatible
        if (!compilerOptions.jsxFactory?.startsWith('svelte')) {
            // Default to regular svelte, this causes the usage of the "svelte.JSX" namespace
            // We don't need to add a switch for svelte-native because the jsx is only relevant
            // within Svelte files, which this plugin does not deal with.
            compilerOptions.jsxFactory = 'svelte.createElement';
        }
    }

    function isSvelteProject(info: ts.server.PluginCreateInfo) {
        // Add more checks like "no Svelte file found" or "no config file found"?
        const compilerOptions = info.project.getCompilerOptions();
        const isNoJsxProject =
            (!compilerOptions.jsx || compilerOptions.jsx === modules.typescript.JsxEmit.Preserve) &&
            (!compilerOptions.jsxFactory || compilerOptions.jsxFactory.startsWith('svelte')) &&
            !compilerOptions.jsxFragmentFactory &&
            !compilerOptions.jsxImportSource;
        return isNoJsxProject;
    }

    return { create, getExternalFiles };
}

export = init;
