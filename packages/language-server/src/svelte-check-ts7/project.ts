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

export interface ProjectDiagnostics {
    /** Problems in the tsconfig (and the configs it extends) */
    config: ApiDiagnostic[];
    /**
     * Program-wide and global diagnostics, deduplicated. If there are syntax errors, only the
     * content mapper's own problems (like tsc).
     */
    program: ApiDiagnostic[];
    /** Syntactic diagnostics, or if there are none, semantic (and declaration) diagnostics */
    files: Map<string, ApiDiagnostic[]>;
}

/**
 * The project of one tsconfig in a TS7 API session (`tsc --api`, owned by `SvelteCheckTs7`).
 *
 * Keeps the latest snapshot. `createSnapshot` doesn't build on earlier snapshots: it starts from a
 * new root, with every file read and parsed again (the API session only caches the content mapper's
 * transforms). In watch mode, the next snapshot is therefore derived from the previous one with the
 * file changes (`update`), and TS7 reuses the files that didn't change.
 *
 * Also gives the virtual-code relocations of the editor middleware access to the program
 * (`TsApiAccess`), like the language server's connection to the TS7 LSP does.
 */
export class Ts7Project implements TsApiAccess {
    private constructor(
        private readonly tsconfigPath: string,
        private snapshot: tsApiAsync.Snapshot,
        readonly astModule: typeof tsAst
    ) {}

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
        return new Ts7Project(tsconfigPath, snapshot, astModule);
    }

    /**
     * Applies changes on disk. TS7's API doesn't watch files itself, it only knows about the
     * changes it's told. The new snapshot is created from the current one, which is released.
     */
    async update(changes: FileNotifications): Promise<void> {
        // Without `ensurePrograms`, TS7 only marks the project as dirty and keeps the old program
        await this.replaceSnapshot({ fileNotifications: changes, ensurePrograms: true });
        if (!this.snapshot.getConfiguredProject(this.tsconfigPath)) {
            // TS7 drops the project when the tsconfig is deleted, and doesn't load it again when
            // the tsconfig is back. Opening it again does (no-op while the tsconfig is missing).
            await this.replaceSnapshot({ closeProjects: [this.tsconfigPath] });
            await this.replaceSnapshot({ openProjects: [this.tsconfigPath] });
        }
    }

    private async replaceSnapshot(changes: tsApiAsync.CreateSnapshotParams): Promise<void> {
        const previous = this.snapshot;
        this.snapshot = await previous.update(changes);
        if (this.snapshot !== previous) {
            await previous.dispose().catch(() => {});
        }
    }

    /** The configured project of the current snapshot */
    get project(): tsApiAsync.Project {
        const project = this.snapshot.getConfiguredProject(this.tsconfigPath);
        if (!project) {
            throw couldNotLoad(this.tsconfigPath);
        }
        return project;
    }

    /** The tsconfig as TS7 parsed it, `extends` resolved */
    get rawConfig(): unknown {
        return this.project.parsedCommandLine.raw;
    }

    get compilerOptions(): tsApiAsync.CompilerOptions {
        return this.project.parsedCommandLine.options;
    }

    getSourceFileNames(): Promise<readonly string[]> {
        return this.project.program.getSourceFileNames();
    }

    /**
     * The diagnostics tsc reports, in tsc's order (`GetDiagnosticsOfAnyProgram` in TypeScript's
     * `tsc/internal/compiler/program.go`). Each step only runs if the previous ones found nothing
     * apart from problems in the tsconfig: syntax errors, then program-wide and global problems,
     * then the semantic check, then (with `noEmit`) declaration problems.
     * No suggestions, svelte-check doesn't print hints.
     *
     * @param files the files to check
     * @param checkFiles `false`: only the tsconfig, program-wide and global diagnostics
     */
    async getDiagnostics(
        files: readonly string[],
        checkFiles: boolean
    ): Promise<ProjectDiagnostics> {
        const program = this.project.program;
        const result: ProjectDiagnostics = {
            config: [...(await program.getConfigFileParsingDiagnostics())],
            program: [],
            files: new Map()
        };
        checkFiles &&= files.length > 0;

        if (checkFiles) {
            const syntactic = await program.getSyntacticDiagnostics(files);
            if (syntactic.length) {
                addByFile(result.files, syntactic);
                // Like tsc: failed transforms are syntax errors, but the content mapper's own
                // problems (it couldn't start, or was disabled after failed transforms) are
                // reported too
                result.program = (await program.getProgramDiagnostics()).filter(
                    isContentMapperFailure
                );
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
        // global problems found while checking
        result.program = dedupeDiagnostics([...(await program.getGlobalDiagnostics())]);

        const options = this.compilerOptions;
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

    /** Syntactic diagnostics only, e.g. to find failed transforms */
    async getSyntacticDiagnostics(files: readonly string[]): Promise<ApiDiagnostic[]> {
        return files.length ? [...(await this.project.program.getSyntacticDiagnostics(files))] : [];
    }

    async withSourceFile<T>(
        uri: string,
        fn: (project: tsApiAsync.Project, sourceFile: tsAst.SourceFile) => Promise<T>
    ): Promise<T | undefined> {
        const project = this.project;
        const sourceFile = await project.program.getSourceFile({ uri });
        return sourceFile ? fn(project, sourceFile) : undefined;
    }

    /** Releases the snapshot. The API session stays open */
    async dispose(): Promise<void> {
        await this.snapshot.dispose().catch(() => {});
    }
}

function couldNotLoad(tsconfigPath: string) {
    return new SvelteCheckTs7Error(`TypeScript could not load ${tsconfigPath}`);
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
