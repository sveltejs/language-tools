import * as fs from 'fs';
import * as path from 'path';
import { SvelteCheckTs7, SvelteCheckTs7Error } from 'svelte-language-server/svelte-check-ts7';
import { SvelteCheckCliOptions } from '../options';
import {
    exitAfterFlush,
    getExitCode,
    instantiateWriter,
    Result,
    writeDiagnostics
} from '../output';
import { loadTypeScript7, resolveTypeScript7, TypeScript7Package } from './typescript';
import { watch } from './watch';

/**
 * svelte-check on TypeScript 7 (`--experimental-ts7`, implied by TypeScript 7.1 as `typescript`): TypeScript diagnostics from the project's
 * TypeScript 7.1+ through its API, with `.svelte` files transformed by the content mapper that the
 * tsconfig configures.
 */
export async function run(opts: SvelteCheckCliOptions) {
    const writer = instantiateWriter(opts);
    // validated in options.ts
    const tsconfig = opts.tsconfig!;

    let svelteCheck: SvelteCheckTs7;
    try {
        assertSvelte5(tsconfig);
        const typescriptPackage = resolveTypeScript7(tsconfig);
        // which path runs, also when it's implied by TypeScript 7.1 as `typescript` (stderr keeps
        // the machine-readable output as it is)
        console.error(
            `svelte-check: experimental TypeScript 7 support, with TypeScript ${typescriptPackage.version} (${typescriptPackage.moduleName})`
        );
        const typescript = await loadTypeScript7(typescriptPackage, tsconfig);
        ensureNodeOnPath();
        setContentMapperTypeScript(typescriptPackage);

        svelteCheck = new SvelteCheckTs7(opts.workspaceUri.fsPath, {
            tsconfig,
            typescript,
            configPath: opts.config,
            compilerWarnings: opts.compilerWarnings,
            diagnosticSources: opts.diagnosticSources
        });
    } catch (error) {
        if (!(error instanceof SvelteCheckTs7Error)) {
            throw error;
        }
        writer.failure(error);
        exitAfterFlush(1);
        return;
    }

    if (opts.watch) {
        await watch(opts, writer, svelteCheck);
        return;
    }

    let result: Result | null = null;
    try {
        result = writeDiagnostics(opts.workspaceUri, writer, await svelteCheck.getDiagnostics());
    } catch (error) {
        if (!(error instanceof SvelteCheckTs7Error)) {
            throw error;
        }
        writer.failure(error);
    } finally {
        await svelteCheck.dispose();
    }
    exitAfterFlush(getExitCode(result, opts));
}

/** The TypeScript 7 path targets Svelte 5 for now */
function assertSvelte5(tsconfigPath: string) {
    let version: string | undefined;
    try {
        const packageJsonPath = require.resolve('svelte/package.json', {
            paths: [path.dirname(tsconfigPath)]
        });
        version = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')).version;
    } catch {
        // not resolvable from the project: the content mapper and the Svelte plugin use their own
    }
    if (version && parseInt(version, 10) < 5) {
        throw new SvelteCheckTs7Error(
            `svelte-check --experimental-ts7 supports Svelte 5 only, found Svelte ${version}`
        );
    }
}

/**
 * The content mapper parses the scripts of Svelte files with the TypeScript named by this variable
 * (default: the first TypeScript 7.1+ it resolves from the project, as `typescript` or as the
 * alias). Make that the exact TypeScript 7 that checks them. TypeScript starts the
 * mapper with svelte-check's environment (svelte-check → TS7 API process → mapper process).
 * A value the user set is kept.
 */
function setContentMapperTypeScript(pkg: TypeScript7Package) {
    process.env[CONTENT_MAPPER_TYPESCRIPT_ENV] ??= path.dirname(pkg.packageJsonPath);
}

const CONTENT_MAPPER_TYPESCRIPT_ENV = 'SVELTE_CONTENT_MAPPER_TYPESCRIPT';

/**
 * TypeScript starts the content mapper with the command in its package.json, `node …`. Make that
 * the Node.js that runs svelte-check, which also works when `node` isn't on PATH (version
 * managers like nvm, GUI apps).
 */
function ensureNodeOnPath() {
    if (!path.basename(process.execPath).toLowerCase().startsWith('node')) {
        return;
    }
    const nodeDirectory = path.dirname(process.execPath);
    const currentPath = process.env.PATH ?? '';
    if (currentPath.split(path.delimiter)[0] !== nodeDirectory) {
        process.env.PATH = nodeDirectory + path.delimiter + currentPath;
    }
}
