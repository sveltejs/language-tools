import type { TsApiAccess } from '../plugins/typescript-go/TsApiService';
import type { tsApiAsync, tsAst } from '../plugins/typescript-go/types';
import type { ApiDiagnostic } from './convert';
import { dedupeDiagnostics, SvelteCheckTs7Error } from './infrastructure';

export interface TypeScript7Modules {
    /** `typescript/async` of the project's TypeScript (7.1 or newer) */
    api: typeof tsApiAsync;
    /** `typescript/ast` of the same installation */
    ast: typeof tsAst;
}

export interface ProjectDiagnostics {
    /** Problems in the tsconfig (and the configs it extends) */
    config: ApiDiagnostic[];
    /** Program-wide and global diagnostics, deduplicated */
    program: ApiDiagnostic[];
}

/**
 * One TS7 API session (`tsc --api`, spawned by the API client) with the project of one tsconfig.
 * `runExternalCode` lets TS7 start the content mapper configured in the tsconfig.
 *
 * Also gives the virtual-code relocations of the editor middleware access to the program
 * (`TsApiAccess`), like the language server's connection to the TS7 LSP does.
 */
export class Ts7Project implements TsApiAccess {
    private constructor(
        private readonly api: tsApiAsync.API,
        private readonly snapshot: tsApiAsync.Snapshot,
        readonly project: tsApiAsync.Project,
        readonly astModule: typeof tsAst
    ) {}

    static async open(
        modules: TypeScript7Modules,
        tsconfigPath: string,
        cwd: string
    ): Promise<Ts7Project> {
        const api = new modules.api.API({ cwd, runExternalCode: true });
        try {
            const snapshot = await api.createSnapshot({ openProjects: [tsconfigPath] });
            const project = snapshot.getConfiguredProject(tsconfigPath);
            if (!project) {
                throw new SvelteCheckTs7Error(`TypeScript could not load ${tsconfigPath}`);
            }
            return new Ts7Project(api, snapshot, project, modules.ast);
        } catch (error) {
            await api.close().catch(() => {});
            throw error;
        }
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

    async getProjectDiagnostics(): Promise<ProjectDiagnostics> {
        const program = this.project.program;
        const [config, programDiagnostics, global] = await Promise.all([
            program.getConfigFileParsingDiagnostics(),
            program.getProgramDiagnostics(),
            program.getGlobalDiagnostics()
        ]);
        return {
            config: [...config],
            program: dedupeDiagnostics([...programDiagnostics, ...global])
        };
    }

    /** Syntactic and semantic diagnostics (no suggestions, svelte-check doesn't print hints) */
    async getFileDiagnostics(files: readonly string[]): Promise<Map<string, ApiDiagnostic[]>> {
        const byFile = new Map<string, ApiDiagnostic[]>();
        if (!files.length) {
            return byFile;
        }

        const program = this.project.program;
        const [syntactic, semantic] = await Promise.all([
            program.getSyntacticDiagnostics(files),
            program.getSemanticDiagnostics(files)
        ]);
        for (const diagnostic of [...syntactic, ...semantic]) {
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
        return byFile;
    }

    async withSourceFile<T>(
        uri: string,
        fn: (project: tsApiAsync.Project, sourceFile: tsAst.SourceFile) => Promise<T>
    ): Promise<T | undefined> {
        const sourceFile = await this.project.program.getSourceFile({ uri });
        return sourceFile ? fn(this.project, sourceFile) : undefined;
    }

    async close(): Promise<void> {
        await this.snapshot.dispose().catch(() => {});
        await this.api.close();
    }
}
