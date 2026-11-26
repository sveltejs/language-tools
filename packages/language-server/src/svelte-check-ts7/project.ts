import { join } from 'path';
import type { TsApiAccess } from '../plugins/typescript-go/TsApiService';
import type { tsApiAsync, tsAst } from '../plugins/typescript-go/types';
import type { ApiDiagnostic } from './convert';
import { dedupeDiagnostics, isContentMapperFailure, SvelteCheckTs7Error } from './infrastructure';

export interface TypeScript7Modules {
    /** `typescript/async` of the project's TypeScript (7.1 or newer) */
    api: typeof tsApiAsync;
    /** `typescript/ast` of the same installation */
    ast: typeof tsAst;
}

/** Files created, changed or deleted on disk since the last snapshot */
export type FileNotifications = tsApiAsync.FileNotifications;

/** The diagnostics of one file in one of the projects that contain it */
export interface ProjectFileDiagnostics {
    /** Access to that project's program, e.g. for post-processing */
    program: TsApiAccess;
    diagnostics: ApiDiagnostic[];
}

export interface ProjectDiagnostics {
    /** Problems in the tsconfigs (and the configs they extend), deduplicated */
    config: ApiDiagnostic[];
    /**
     * Program-wide and global diagnostics, deduplicated. For a project with syntax errors, only
     * the content mapper's own problems (like tsc).
     */
    program: ApiDiagnostic[];
    /**
     * Per file, per project that contains it: syntactic diagnostics, or if the project has none,
     * semantic (and declaration) diagnostics. A file in several projects is checked in each of
     * them, because their compiler options can differ.
     */
    files: Map<string, ProjectFileDiagnostics[]>;
    /**
     * The programs that got to the semantic check (no syntax, program-wide or global errors), by
     * tsconfig (as in `ProgramFile.tsconfigs`). Only their files get semantic diagnostics that
     * svelte-check adds itself, like the ones for unresolved `.svelte` imports.
     */
    semanticallyChecked: Map<string, TsApiAccess>;
}

/** A file of the programs, and the tsconfigs of all programs that contain it */
export interface ProgramFile {
    fileName: string;
    tsconfigs: string[];
}

/** A tsconfig of the reference graph */
interface GraphEntry {
    tsconfig: string;
    /** The tsconfig that references it, unless it's the root */
    referencedBy?: string;
}

/**
 * The projects of a tsconfig in a TS7 API session (`tsc --api`, owned by `SvelteCheckTs7`): the
 * tsconfig itself, and the projects it references (`references`, transitively). Each of them is
 * loaded and checked on its own, with its own compiler options; a file in several projects is
 * checked in each of them. This makes a solution-style tsconfig work, like Vite's, which has
 * `"files": []` and references a tsconfig for the app and one for the Node.js files.
 *
 * Unlike `tsc -b`, the reference graph isn't validated (cycles are just followed once), and
 * nothing is built in dependency order.
 *
 * Keeps the latest snapshot. `createSnapshot` doesn't build on earlier snapshots: it starts from a
 * new root, with every file read and parsed again (the API session only caches the content mapper's
 * transforms). In watch mode, the next snapshot is therefore derived from the previous one with the
 * file changes (`update`), and TS7 reuses the files that didn't change.
 */
export class Ts7Project {
    /**
     * The tsconfig and the tsconfigs it references, in checking order, including referenced ones
     * that TypeScript couldn't load (e.g. deleted). Those are retried on every update.
     */
    private graph: GraphEntry[];

    private constructor(
        private readonly tsconfigPath: string,
        private snapshot: tsApiAsync.Snapshot,
        readonly astModule: typeof tsAst
    ) {
        this.graph = [{ tsconfig: tsconfigPath }];
    }

    /** `api` must be created with `runExternalCode`, so that TS7 starts the content mapper */
    static async open(
        api: tsApiAsync.API,
        astModule: typeof tsAst,
        tsconfigPath: string
    ): Promise<Ts7Project> {
        const snapshot = await api.createSnapshot({ openProjects: [tsconfigPath] });
        if (!snapshot.getConfiguredProject(tsconfigPath)) {
            await snapshot.dispose().catch(() => {});
            throw couldNotLoad(tsconfigPath);
        }
        const project = new Ts7Project(tsconfigPath, snapshot, astModule);
        try {
            await project.syncReferences();
        } catch (error) {
            await project.dispose();
            throw error;
        }
        return project;
    }

    /**
     * Applies changes on disk. TS7's API doesn't watch files itself, it only knows about the
     * changes it's told. The new snapshot is created from the current one, which is released.
     */
    async update(changes: FileNotifications): Promise<void> {
        // Without `ensurePrograms`, TS7 only marks the projects as dirty and keeps the old programs
        await this.replaceSnapshot({ fileNotifications: changes, ensurePrograms: true });
        await this.syncReferences();
    }

    /**
     * Loads the tsconfigs of the reference graph that aren't loaded, follows `references` (which
     * may have changed), and closes the projects that are no longer referenced.
     */
    private async syncReferences(): Promise<void> {
        // TS7 drops a project when its tsconfig is deleted, and doesn't load it again when the
        // tsconfig is back, not even with `openProjects`. Closing it first does.
        await this.reopen(
            this.graph.map((entry) => entry.tsconfig).filter((t) => !this.isLoaded(t))
        );

        const graph: GraphEntry[] = [{ tsconfig: this.tsconfigPath }];
        const seen = new Set([this.key(this.tsconfigPath)]);
        for (let i = 0; i < graph.length; i++) {
            const tsconfig = graph[i].tsconfig;
            const references = (
                this.snapshot.getConfiguredProject(tsconfig)?.parsedCommandLine.projectReferences ??
                []
            )
                .map((reference) => toTsconfigPath(reference.path))
                .filter((reference) => !seen.has(this.key(reference)));
            await this.reopen(references.filter((reference) => !this.isLoaded(reference)));
            for (const reference of references) {
                seen.add(this.key(reference));
                graph.push({ tsconfig: reference, referencedBy: tsconfig });
            }
        }
        this.graph = graph;

        const unreferenced: string[] = [];
        for (const { configFileName } of this.snapshot.getProjects()) {
            if (configFileName && !seen.has(this.key(configFileName))) {
                unreferenced.push(configFileName);
            }
        }
        if (unreferenced.length) {
            await this.replaceSnapshot({ closeProjects: unreferenced });
        }
    }

    private async reopen(tsconfigs: string[]): Promise<void> {
        if (tsconfigs.length) {
            await this.replaceSnapshot({ closeProjects: tsconfigs });
            await this.replaceSnapshot({ openProjects: tsconfigs });
        }
    }

    private isLoaded(tsconfig: string): boolean {
        return !!this.snapshot.getConfiguredProject(tsconfig);
    }

    /** The path as TS7 writes it, if it's loaded */
    private key(tsconfig: string): string {
        return this.snapshot.getConfiguredProject(tsconfig)?.configFileName ?? tsconfig;
    }

    private async replaceSnapshot(changes: tsApiAsync.CreateSnapshotParams): Promise<void> {
        const previous = this.snapshot;
        this.snapshot = await previous.update(changes);
        if (this.snapshot !== previous) {
            await previous.dispose().catch(() => {});
        }
    }

    /**
     * The configured projects of the current snapshot, in checking order. Throws if one of the
     * tsconfigs can't be loaded: its files would silently not be checked.
     */
    get projects(): tsApiAsync.Project[] {
        const projects: tsApiAsync.Project[] = [];
        for (const { tsconfig, referencedBy } of this.graph) {
            const project = this.snapshot.getConfiguredProject(tsconfig);
            if (!project) {
                throw couldNotLoad(tsconfig, referencedBy);
            }
            projects.push(project);
        }
        return projects;
    }

    /** The tsconfigs as TS7 parsed them, `extends` resolved */
    get rawConfigs(): unknown[] {
        return this.projects.map((project) => project.parsedCommandLine.raw);
    }

    /** The tsconfig paths of the reference graph, in checking order, also the ones not loaded */
    get tsconfigPaths(): string[] {
        return this.graph.map((entry) => entry.tsconfig);
    }

    /** The files of all programs, each with the projects that contain it */
    async getProgramFiles(): Promise<ProgramFile[]> {
        const byName = new Map<string, ProgramFile>();
        for (const project of this.projects) {
            const tsconfig = configFileName(project);
            for (const fileName of await project.program.getSourceFileNames()) {
                const file = byName.get(fileName);
                if (file) {
                    file.tsconfigs.push(tsconfig);
                } else {
                    byName.set(fileName, { fileName, tsconfigs: [tsconfig] });
                }
            }
        }
        return [...byName.values()];
    }

    /**
     * The diagnostics `tsc` reports for each project, in tsc's order (`GetDiagnosticsOfAnyProgram`
     * in TypeScript's `tsc/internal/compiler/program.go`). In each project, each step only runs if
     * the previous ones found nothing apart from problems in the tsconfig: syntax errors, then
     * program-wide and global problems, then the semantic check, then (with `noEmit`) declaration
     * problems. No suggestions, svelte-check doesn't print hints.
     *
     * @param files the files to check, each in all of its projects (see `getProgramFiles`)
     * @param checkFiles `false`: only the tsconfig, program-wide and global diagnostics
     */
    async getDiagnostics(
        files: readonly ProgramFile[],
        checkFiles: boolean
    ): Promise<ProjectDiagnostics> {
        const projects = this.projects;
        const results = await Promise.all(
            projects.map((project) =>
                getProjectDiagnostics(project, filesOf(project, files), checkFiles)
            )
        );
        const result: ProjectDiagnostics = {
            config: [],
            program: [],
            files: new Map(),
            semanticallyChecked: new Map()
        };
        results.forEach((projectResult, index) => {
            const program = this.programAccess(projects[index]);
            if (projectResult.semanticallyChecked) {
                result.semanticallyChecked.set(configFileName(projects[index]), program);
            }
            result.config.push(...projectResult.config);
            result.program.push(...projectResult.program);
            for (const [fileName, diagnostics] of projectResult.files) {
                const list = result.files.get(fileName) ?? [];
                list.push({ program, diagnostics });
                result.files.set(fileName, list);
            }
        });
        result.config = dedupeDiagnostics(result.config);
        result.program = dedupeDiagnostics(result.program);
        return result;
    }

    /** Syntactic diagnostics only, e.g. to find failed transforms */
    async getSyntacticDiagnostics(files: readonly ProgramFile[]): Promise<ApiDiagnostic[]> {
        const results = await Promise.all(
            this.projects.map(async (project) => {
                const fileNames = filesOf(project, files);
                return fileNames.length
                    ? [...(await project.program.getSyntacticDiagnostics(fileNames))]
                    : [];
            })
        );
        return dedupeDiagnostics(results.flat());
    }

    /** Problems in the tsconfigs, and program-wide and global problems (like content mapper failures) */
    async getProjectProblems(): Promise<ApiDiagnostic[]> {
        const results = await Promise.all(
            this.projects.map(async (project) => [
                ...(await project.program.getConfigFileParsingDiagnostics()),
                ...(await project.program.getProgramDiagnostics()),
                ...(await project.program.getGlobalDiagnostics())
            ])
        );
        return dedupeDiagnostics(results.flat());
    }

    /**
     * Access to one project's program, for the virtual-code relocations of the editor middleware
     * (`TsApiAccess`), like the language server's connection to the TS7 LSP
     */
    private programAccess(project: tsApiAsync.Project): TsApiAccess {
        return {
            astModule: this.astModule,
            withSourceFile: async (uri, fn) => {
                const sourceFile = await project.program.getSourceFile({ uri });
                return sourceFile ? fn(project, sourceFile) : undefined;
            }
        };
    }

    /** Releases the snapshot. The API session stays open */
    async dispose(): Promise<void> {
        await this.snapshot.dispose().catch(() => {});
    }
}

async function getProjectDiagnostics(
    project: tsApiAsync.Project,
    files: string[],
    checkFiles: boolean
): Promise<{
    config: ApiDiagnostic[];
    program: ApiDiagnostic[];
    files: Map<string, ApiDiagnostic[]>;
    semanticallyChecked: boolean;
}> {
    const program = project.program;
    const result = {
        config: [...(await program.getConfigFileParsingDiagnostics())],
        program: [] as ApiDiagnostic[],
        files: new Map<string, ApiDiagnostic[]>(),
        semanticallyChecked: false
    };
    checkFiles &&= files.length > 0;

    if (checkFiles) {
        const syntactic = await program.getSyntacticDiagnostics(files);
        if (syntactic.length) {
            addByFile(result.files, syntactic);
            // Like tsc: failed transforms are syntax errors, but the content mapper's own
            // problems (it couldn't start, or was disabled after failed transforms) are
            // reported too
            result.program = (await program.getProgramDiagnostics()).filter(isContentMapperFailure);
            return result;
        }
    }

    const [programDiagnostics, global] = await Promise.all([
        program.getProgramDiagnostics(),
        program.getGlobalDiagnostics()
    ]);
    result.program = dedupeDiagnostics([...programDiagnostics, ...global]);
    if (!checkFiles || result.program.length) {
        return result;
    }

    const semantic = await program.getSemanticDiagnostics(files);
    addByFile(result.files, semantic);
    result.semanticallyChecked = true;
    // global problems found while checking
    result.program = dedupeDiagnostics([...(await program.getGlobalDiagnostics())]);

    const options = project.parsedCommandLine.options;
    if (
        !semantic.length &&
        !result.program.length &&
        options.noEmit &&
        (options.declaration || options.composite)
    ) {
        addByFile(result.files, await program.getDeclarationDiagnostics(files));
    }
    return result;
}

function configFileName(project: tsApiAsync.Project): string {
    return project.configFileName ?? '';
}

function filesOf(project: tsApiAsync.Project, files: readonly ProgramFile[]): string[] {
    const tsconfig = configFileName(project);
    return files.filter((file) => file.tsconfigs.includes(tsconfig)).map((file) => file.fileName);
}

/** A reference can name a tsconfig file or the directory of a `tsconfig.json` */
function toTsconfigPath(referencePath: string): string {
    return referencePath.endsWith('.json') ? referencePath : join(referencePath, 'tsconfig.json');
}

function couldNotLoad(tsconfigPath: string, referencedBy?: string) {
    return new SvelteCheckTs7Error(
        `TypeScript could not load ${tsconfigPath}` +
            (referencedBy
                ? `, which ${referencedBy} references. Its files would not be checked.`
                : '')
    );
}

function addByFile(byFile: Map<string, ApiDiagnostic[]>, diagnostics: readonly ApiDiagnostic[]) {
    for (const diagnostic of diagnostics) {
        if (!diagnostic.fileName) {
            continue;
        }
        let list = byFile.get(diagnostic.fileName);
        if (!list) {
            list = [];
            byFile.set(diagnostic.fileName, list);
        }
        list.push(diagnostic);
    }
}
