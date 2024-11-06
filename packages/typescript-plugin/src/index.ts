import { dirname, join, resolve } from 'path';
import { decorateLanguageService, isPatched } from './language-service';
import { Logger } from './logger';
import { patchModuleLoader } from './module-loader';
import { SvelteSnapshotManager } from './svelte-snapshots';
import type ts from 'typescript/lib/tsserverlibrary';
import { ConfigManager, Configuration } from './config-manager';
import { ProjectSvelteFilesManager } from './project-svelte-files';
import {
    getConfigPathForProject,
    getProjectDirectory,
    importSvelteCompiler,
    isSvelteProject
} from './utils';
import { internalHelpers } from 'svelte2tsx';

function init(modules: { typescript: typeof ts }): ts.server.PluginModule {
    const configManager = new ConfigManager();
    let resolvedSvelteTsxFiles: string[] | undefined;
    const isSvelteProjectCache = new Map<string, boolean>();

    function create(info: ts.server.PluginCreateInfo) {
        const logger = new Logger(info.project.projectService.logger);
        if (
            !(info.config as Configuration)?.assumeIsSvelteProject &&
            !isSvelteProjectWithCache(info.project)
        ) {
            logger.log('Detected that this is not a Svelte project, abort patching TypeScript');
            return info.languageService;
        }

        if (isPatched(info.project)) {
            logger.log('Already patched. Checking tsconfig updates.');

            ProjectSvelteFilesManager.getInstance(
                info.project.getProjectName()
            )?.updateProjectConfig(info.languageServiceHost);

            return info.languageService;
        }

        configManager.updateConfigFromPluginConfig(info.config);
        if (configManager.getConfig().enable) {
            logger.log('Starting Svelte plugin');
        } else {
            logger.log('Svelte plugin disabled');
            logger.log(info.config);
        }

        // This call the ConfiguredProject.getParsedCommandLine
        // where it'll try to load the cached version of the parsedCommandLine
        const parsedCommandLine = info.languageServiceHost.getParsedCommandLine?.(
            getConfigPathForProject(info.project)
        );

        // For some reason it's no longer enough to patch this at the projectService level, so we do it here, too
        // TODO investigate if we can use the script snapshot for all Svelte files, too, enabling Svelte file
        // updates getting picked up without a file save - move this logic into the snapshot manager then?
        const getScriptSnapshot = info.languageServiceHost.getScriptSnapshot.bind(
            info.languageServiceHost
        );
        info.languageServiceHost.getScriptSnapshot = (fileName) => {
            const normalizedPath = fileName.replace(/\\/g, '/');
            if (normalizedPath.endsWith('node_modules/svelte/types/runtime/ambient.d.ts')) {
                return modules.typescript.ScriptSnapshot.fromString('');
            } else if (normalizedPath.endsWith('node_modules/svelte/types/index.d.ts')) {
                const snapshot = getScriptSnapshot(fileName);
                if (snapshot) {
                    const originalText = snapshot.getText(0, snapshot.getLength());
                    const startIdx = originalText.indexOf(`declare module '*.svelte' {`);
                    const endIdx = originalText.indexOf(`\n}`, startIdx + 1) + 2;
                    return modules.typescript.ScriptSnapshot.fromString(
                        originalText.substring(0, startIdx) +
                            ' '.repeat(endIdx - startIdx) +
                            originalText.substring(endIdx)
                    );
                }
            } else if (normalizedPath.endsWith('svelte2tsx/svelte-jsx.d.ts')) {
                // Remove the dom lib reference to not load these ambient types in case
                // the user has a tsconfig.json with different lib settings like in
                // https://github.com/sveltejs/language-tools/issues/1733
                const snapshot = getScriptSnapshot(fileName);
                if (snapshot) {
                    const originalText = snapshot.getText(0, snapshot.getLength());
                    const toReplace = '/// <reference lib="dom" />';
                    return modules.typescript.ScriptSnapshot.fromString(
                        originalText.replace(toReplace, ' '.repeat(toReplace.length))
                    );
                }
                return snapshot;
            } else if (normalizedPath.endsWith('svelte2tsx/svelte-shims.d.ts')) {
                const snapshot = getScriptSnapshot(fileName);
                if (snapshot) {
                    let originalText = snapshot.getText(0, snapshot.getLength());
                    if (!originalText.includes('// -- start svelte-ls-remove --')) {
                        return snapshot; // uses an older version of svelte2tsx or is already patched
                    }
                    const startIdx = originalText.indexOf('// -- start svelte-ls-remove --');
                    const endIdx = originalText.indexOf('// -- end svelte-ls-remove --');
                    originalText =
                        originalText.substring(0, startIdx) +
                        ' '.repeat(endIdx - startIdx) +
                        originalText.substring(endIdx);
                    return modules.typescript.ScriptSnapshot.fromString(originalText);
                }
                return snapshot;
            }
            return getScriptSnapshot(fileName);
        };

        const svelteOptions = parsedCommandLine?.raw?.svelteOptions || { namespace: 'svelteHTML' };
        logger.log('svelteOptions:', svelteOptions);
        logger.debug(parsedCommandLine?.wildcardDirectories);

        const snapshotManager = new SvelteSnapshotManager(
            modules.typescript,
            info.project.projectService,
            svelteOptions,
            logger,
            configManager,
            importSvelteCompiler(getProjectDirectory(info.project))
        );

        const projectSvelteFilesManager = parsedCommandLine
            ? new ProjectSvelteFilesManager(
                  modules.typescript,
                  info.project,
                  info.serverHost,
                  snapshotManager,
                  logger,
                  parsedCommandLine,
                  configManager
              )
            : undefined;

        const moduleLoaderDisposable = patchModuleLoader(
            logger,
            snapshotManager,
            modules.typescript,
            info.languageServiceHost,
            info.project,
            configManager
        );

        const updateProjectWhenConfigChanges = () => {
            // enabling/disabling the plugin means TS has to recompute stuff
            // don't clear semantic cache here
            // typescript now expected the program updates to be completely in their control
            // doing so will result in a crash
            // @ts-expect-error internal API since TS 5.5
            info.project.markAsDirty?.();

            // updateGraph checks for new root files
            // if there's no tsconfig there isn't root files to check
            if (projectSvelteFilesManager) {
                info.project.updateGraph();
            }
        };
        configManager.onConfigurationChanged(updateProjectWhenConfigChanges);

        return decorateLanguageService(
            info.languageService,
            snapshotManager,
            logger,
            configManager,
            info,
            modules.typescript,
            () => {
                projectSvelteFilesManager?.dispose();
                configManager.removeConfigurationChangeListener(updateProjectWhenConfigChanges);
                moduleLoaderDisposable.dispose();
            }
        );
    }

    function getExternalFiles(project: ts.server.Project) {
        if (!isSvelteProjectWithCache(project) || !configManager.getConfig().enable) {
            return [];
        }

        const configFilePath = getProjectDirectory(project);

        // Needed so the ambient definitions are known inside the tsx files
        const svelteTsxFiles = resolveSvelteTsxFiles(configFilePath);

        if (!configFilePath) {
            svelteTsxFiles.forEach((file) => {
                openSvelteTsxFileForInferredProject(project, file);
            });
        }

        // let ts know project svelte files to do its optimization
        return svelteTsxFiles.concat(
            ProjectSvelteFilesManager.getInstance(project.getProjectName())?.getFiles() ?? []
        );
    }

    function resolveSvelteTsxFiles(configFilePath: string | undefined) {
        if (resolvedSvelteTsxFiles) {
            return resolvedSvelteTsxFiles;
        }

        const svelteTsPath = dirname(require.resolve('svelte2tsx'));
        const svelteCompilerPath = require.resolve(
            'svelte/compiler',
            configFilePath ? { paths: [configFilePath] } : undefined
        );
        const sveltePath = dirname(
            require.resolve(
                'svelte/package.json',
                configFilePath ? { paths: [configFilePath] } : undefined
            )
        );
        const VERSION = require(svelteCompilerPath).VERSION;

        resolvedSvelteTsxFiles = internalHelpers.get_global_types(
            modules.typescript.sys,
            VERSION.split('.')[0] === '3',
            sveltePath,
            svelteTsPath,
            configFilePath
        );

        return resolvedSvelteTsxFiles;
    }

    function isSvelteProjectWithCache(project: ts.server.Project) {
        const cached = isSvelteProjectCache.get(project.getProjectName());
        if (cached !== undefined) {
            return cached;
        }

        const result = !!isSvelteProject(project);
        isSvelteProjectCache.set(project.getProjectName(), result);
        return result;
    }

    function onConfigurationChanged(config: Configuration) {
        if (configManager.isConfigChanged(config)) {
            configManager.updateConfigFromPluginConfig(config);
        }
    }

    /**
     * TypeScript doesn't load the external files in projects without a config file. So we load it by ourselves.
     * TypeScript also seems to expect files added to the root to be opened by the client in this situation.
     */
    function openSvelteTsxFileForInferredProject(project: ts.server.Project, file: string) {
        const normalizedPath = modules.typescript.server.toNormalizedPath(file);
        if (project.containsFile(normalizedPath)) {
            return;
        }

        const scriptInfo = project.projectService.getOrCreateScriptInfoForNormalizedPath(
            normalizedPath,
            /*openedByClient*/ true,
            project.readFile(file)
        );

        if (!scriptInfo) {
            return;
        }

        if (!project.projectService.openFiles.has(scriptInfo.path)) {
            project.projectService.openFiles.set(scriptInfo.path, undefined);
        }

        if ((project as any).projectRootPath) {
            // Only add the file to the project if it has a projectRootPath, because else
            // a ts.Assert error will be thrown when multiple inferred projects are tried
            // to be merged.
            project.addRoot(scriptInfo);
        }
    }

    return { create, getExternalFiles, onConfigurationChanged };
}

export = init;
