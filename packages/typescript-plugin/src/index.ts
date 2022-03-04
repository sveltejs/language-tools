import { dirname, resolve } from 'path';
import { decorateLanguageService, isPatched } from './language-service';
import { Logger } from './logger';
import { patchModuleLoader } from './module-loader';
import { SvelteSnapshotManager } from './svelte-snapshots';
import type ts from 'typescript/lib/tsserverlibrary';
import { ConfigManager, Configuration } from './config-manager';

function init(modules: { typescript: typeof ts }) {
    const configManager = new ConfigManager();

    function create(info: ts.server.PluginCreateInfo) {
        const logger = new Logger(info.project.projectService.logger);
        if (!isSvelteProject(info.project.getCompilerOptions())) {
            logger.log('Detected that this is not a Svelte project, abort patching TypeScript');
            return info.languageService;
        }

        if (isPatched(info.languageService)) {
            logger.log('Already patched');
            return info.languageService;
        }

        configManager.updateConfigFromPluginConfig(info.config);
        if (configManager.getConfig().enable) {
            logger.log('Starting Svelte plugin');
        } else {
            logger.log('Svelte plugin disabled');
            logger.log(info.config);
        }

        // If someone knows a better/more performant way to get svelteOptions,
        // please tell us :)
        const svelteOptions = info.languageServiceHost.getParsedCommandLine?.(
            (info.project.getCompilerOptions() as any).configFilePath
        )?.raw?.svelteOptions || { namespace: 'svelteHTML' };
        logger.log('svelteOptions:', svelteOptions);

        const snapshotManager = new SvelteSnapshotManager(
            modules.typescript,
            info.project.projectService,
            svelteOptions,
            logger,
            configManager
        );

        patchModuleLoader(
            logger,
            snapshotManager,
            modules.typescript,
            info.languageServiceHost,
            info.project,
            configManager
        );

        configManager.onConfigurationChanged(() => {
            // enabling/disabling the plugin means TS has to recompute stuff
            info.languageService.cleanupSemanticCache();
            info.project.markAsDirty();
        });

        return decorateLanguageService(
            info.languageService,
            snapshotManager,
            logger,
            configManager
        );
    }

    function getExternalFiles(project: ts.server.ConfiguredProject) {
        if (!isSvelteProject(project.getCompilerOptions())) {
            return [];
        }

        // Needed so the ambient definitions are known inside the tsx files
        const svelteTsPath = dirname(require.resolve('svelte2tsx'));
        const svelteTsxFiles = [
            './svelte-shims.d.ts',
            './svelte-jsx.d.ts',
            './svelte-native-jsx.d.ts'
        ].map((f) => modules.typescript.sys.resolvePath(resolve(svelteTsPath, f)));
        return svelteTsxFiles;
    }

    function isSvelteProject(compilerOptions: ts.CompilerOptions) {
        // Add more checks like "no Svelte file found" or "no config file found"?
        try {
            const isSvelteProject =
                typeof compilerOptions.configFilePath !== 'string' ||
                require.resolve('svelte', { paths: [compilerOptions.configFilePath] });
            return isSvelteProject;
        } catch (e) {
            // If require.resolve fails, we end up here
            return false;
        }
    }

    function onConfigurationChanged(config: Configuration) {
        configManager.updateConfigFromPluginConfig(config);
    }

    return { create, getExternalFiles, onConfigurationChanged };
}

export = init;
