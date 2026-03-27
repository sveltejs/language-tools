// abstracting the typescript-auto-import-cache package to support our use case

import {
    ProjectService,
    createProjectService as createProjectService50
} from 'typescript-auto-import-cache/out/5_0/projectService';
import { createProject as createProject50 } from 'typescript-auto-import-cache/out/5_0/project';
import { createProject as createProject53 } from 'typescript-auto-import-cache/out/5_3/project';
import { createProject as createProject55 } from 'typescript-auto-import-cache/out/5_5/project';
import type ts from 'typescript';
import { ExportInfoMap } from 'typescript-auto-import-cache/out/5_0/exportInfoMap';
import { ModuleSpecifierCache } from 'typescript-auto-import-cache/out/5_0/moduleSpecifierCache';
import { SymlinkCache } from 'typescript-auto-import-cache/out/5_0/symlinkCache';
import { ProjectPackageJsonInfo } from 'typescript-auto-import-cache/out/5_0/packageJsonCache';

export { ProjectService };

declare module 'typescript' {
    interface LanguageServiceHost {
        /** @internal */ getCachedExportInfoMap?(): ExportInfoMap;
        /** @internal */ getModuleSpecifierCache?(): ModuleSpecifierCache;
        /** @internal */ getGlobalTypingsCacheLocation?(): string | undefined;
        /** @internal */ getSymlinkCache?(files: readonly ts.SourceFile[]): SymlinkCache;
        /** @internal */ getPackageJsonsVisibleToFile?(
            fileName: string,
            rootDir?: string
        ): readonly ProjectPackageJsonInfo[];
        /** @internal */ getPackageJsonAutoImportProvider?(): ts.Program | undefined;
        /** @internal */ useSourceOfProjectReferenceRedirect?(): boolean;
    }
}

export function createProjectService(
    ts: typeof import('typescript'),
    system: ts.System,
    hostConfiguration: {
        preferences: ts.UserPreferences;
    }
) {
    const version = ts.version.split('.');
    const major = parseInt(version[0]);

    if (major < 5) {
        return undefined;
    }

    const projectService = createProjectService50(
        ts,
        system,
        system.getCurrentDirectory(),
        hostConfiguration,
        ts.LanguageServiceMode.Semantic
    );

    return projectService;
}

export function createProject(
    ts: typeof import('typescript'),
    host: ts.LanguageServiceHost,
    createLanguageService: (host: ts.LanguageServiceHost) => ts.LanguageService,
    options: {
        projectService: ProjectService;
        compilerOptions: ts.CompilerOptions;
        currentDirectory: string;
    }
) {
    const factory = getProjectFactory(ts);
    if (!factory) {
        return undefined;
    }
    const project = factory(ts, host, createLanguageService, options);

    const proxyMethods: (keyof typeof project)[] = [
        'getCachedExportInfoMap',
        'getModuleSpecifierCache',
        'getGlobalTypingsCacheLocation',
        'getSymlinkCache',
        'getPackageJsonsVisibleToFile',
        'getPackageJsonAutoImportProvider',
        'includePackageJsonAutoImports'
        // Volar doesn't have the "languageServiceReducedMode" support but we do
        // so don't proxy this method and implement this directly in the ts.LanguageServiceHost
        // 'useSourceOfProjectReferenceRedirect'
    ];
    proxyMethods.forEach((key) => ((host as any)[key] = project[key].bind(project)));

    if (host.log) {
        project.log = host.log.bind(host);
    }

    return project;
}

function getProjectFactory(tsModule: typeof ts) {
    const version = tsModule.version.split('.');
    const major = parseInt(version[0]);
    const minor = parseInt(version[1]);

    if (major < 5) {
        return undefined;
    }

    if (major === 5) {
        if (minor < 3) {
            return createProject50;
        }

        if (minor < 5) {
            return createProject53;
        }
    }

    return createProject55;
}
