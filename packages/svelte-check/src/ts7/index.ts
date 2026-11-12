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
import { loadTypeScript7, resolveTypeScript7 } from './typescript';
import { watch } from './watch';

/**
 * svelte-check on TypeScript 7 (`--experimental-ts7`): TypeScript diagnostics from the project's
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
        const typescript = await loadTypeScript7(resolveTypeScript7(tsconfig), tsconfig);
        ensureNodeOnPath();

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
