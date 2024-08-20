import * as fs from 'fs';
import * as path from 'path';
import sade from 'sade';
import { URI } from 'vscode-uri';

export interface SvelteCheckCliOptions {
    workspaceUri: URI;
    outputFormat: OutputFormat;
    watch: boolean;
    preserveWatchOutput: boolean;
    tsconfig?: string;
    filePathsToIgnore: string[];
    failOnWarnings: boolean;
    compilerWarnings: Record<string, 'error' | 'ignore'>;
    diagnosticSources: DiagnosticSource[];
    threshold: Threshold;
}

export function parseOptions(cb: (opts: SvelteCheckCliOptions) => any) {
    const prog = sade('svelte-check', true)
        .version(require('../../package.json').version) // ends up in dist/src, that's why we go two levels up
        .option(
            '--workspace',
            'Path to your workspace. All subdirectories except node_modules and those listed in `--ignore` are checked. Defaults to current working directory.'
        )
        .option(
            '--output',
            'What output format to use. Options are human, human-verbose, machine, machine-verbose.',
            'human-verbose'
        )
        .option(
            '--watch',
            'Will not exit after one pass but keep watching files for changes and rerun diagnostics',
            false
        )
        .option('--preserveWatchOutput', 'Do not clear the screen in watch mode', false)
        .option(
            '--tsconfig',
            'Pass a path to a tsconfig or jsconfig file. The path can be relative to the workspace path or absolute. Doing this means that only files matched by the files/include/exclude pattern of the config file are diagnosed. It also means that errors from TypeScript and JavaScript files are reported. When not given, searches for the next upper tsconfig/jsconfig in the workspace path.'
        )
        .option(
            '--no-tsconfig',
            'Use this if you only want to check the Svelte files found in the current directory and below and ignore any JS/TS files (they will not be type-checked)',
            false
        )
        .option(
            '--ignore',
            'Only has an effect when using `--no-tsconfig` option. Files/folders to ignore - relative to workspace root, comma-separated, inside quotes. Example: `--ignore "dist,build"`'
        )
        .option(
            '--fail-on-warnings',
            'Will also exit with error code when there are warnings',
            false
        )
        .option(
            '--compiler-warnings',
            'A list of Svelte compiler warning codes. Each entry defines whether that warning should be ignored or treated as an error. Warnings are comma-separated, between warning code and error level is a colon; all inside quotes. Example: `--compiler-warnings "css-unused-selector:ignore,unused-export-let:error"`'
        )
        .option(
            '--diagnostic-sources',
            'A list of diagnostic sources which should run diagnostics on your code. Possible values are `js` (includes TS), `svelte`, `css`. Comma-separated, inside quotes. By default all are active. Example: `--diagnostic-sources "js,svelte"`'
        )
        .option(
            '--threshold',
            'Filters the diagnostics to display. `error` will output only errors while `warning` will output warnings and errors.',
            'warning'
        )
        .action((opts) => {
            const workspaceUri = getWorkspaceUri(opts);
            const tsconfig = getTsconfig(opts, workspaceUri.fsPath);

            if (opts.ignore && tsconfig) {
                throwError('`--ignore` only has an effect when using `--no-tsconfig`');
            }

            cb({
                workspaceUri,
                outputFormat: getOutputFormat(opts),
                watch: !!opts.watch,
                preserveWatchOutput: !!opts.preserveWatchOutput,
                tsconfig,
                filePathsToIgnore: opts.ignore?.split(',') || [],
                failOnWarnings: !!opts['fail-on-warnings'],
                compilerWarnings: getCompilerWarnings(opts),
                diagnosticSources: getDiagnosticSources(opts),
                threshold: getThreshold(opts)
            });
        });

    prog.parse(process.argv, {
        unknown: (arg) => `Unknown option ${arg}`
    });
}

const outputFormats = ['human', 'human-verbose', 'machine', 'machine-verbose'] as const;
type OutputFormat = (typeof outputFormats)[number];

function getOutputFormat(opts: Record<string, any>): OutputFormat {
    return outputFormats.includes(opts.output) ? opts.output : 'human-verbose';
}

function getWorkspaceUri(opts: Record<string, any>) {
    let workspaceUri;
    let workspacePath = opts.workspace;
    if (workspacePath) {
        if (!path.isAbsolute(workspacePath)) {
            workspacePath = path.resolve(process.cwd(), workspacePath);
        }
        workspaceUri = URI.file(workspacePath);
    } else {
        workspaceUri = URI.file(process.cwd());
    }
    return workspaceUri;
}

function findFile(searchPath: string, fileName: string) {
    try {
        for (;;) {
            const filePath = path.join(searchPath, fileName);
            if (fs.existsSync(filePath)) {
                return filePath;
            }
            const parentPath = path.dirname(searchPath);
            if (parentPath === searchPath) {
                return;
            }
            searchPath = parentPath;
        }
    } catch (e) {
        return;
    }
}

function getTsconfig(myArgs: Record<string, any>, workspacePath: string) {
    // Work around undocumented behavior in Sade where `no-tsconfig` is never true / means "tsconfig is false"
    if (myArgs['no-tsconfig'] || process.argv.includes('--no-tsconfig')) {
        return undefined;
    }
    let tsconfig: string | undefined =
        typeof myArgs.tsconfig === 'string' ? myArgs.tsconfig : undefined;
    if (!tsconfig) {
        const ts = findFile(workspacePath, 'tsconfig.json');
        const js = findFile(workspacePath, 'jsconfig.json');
        tsconfig = !!ts && (!js || ts.length >= js.length) ? ts : js;
    }
    if (tsconfig && !path.isAbsolute(tsconfig)) {
        tsconfig = path.join(workspacePath, tsconfig);
    }
    if (tsconfig && !fs.existsSync(tsconfig)) {
        throwError('Could not find tsconfig/jsconfig file at ' + myArgs.tsconfig);
    }
    return tsconfig;
}

function throwError(msg: string) {
    throw new Error('Invalid svelte-check CLI args: ' + msg);
}

function getCompilerWarnings(opts: Record<string, any>) {
    return stringToObj(opts['compiler-warnings']);

    function stringToObj(str = '') {
        return str
            .split(',')
            .map((s) => s.trim())
            .filter((s) => !!s)
            .reduce(
                (settings, setting) => {
                    const [name, val] = setting.split(':');
                    if (val === 'error' || val === 'ignore') {
                        settings[name] = val;
                    }
                    return settings;
                },
                <Record<string, 'error' | 'ignore'>>{}
            );
    }
}

const diagnosticSources = ['js', 'css', 'svelte'] as const;
type DiagnosticSource = (typeof diagnosticSources)[number];

function getDiagnosticSources(opts: Record<string, any>): DiagnosticSource[] {
    const sources = opts['diagnostic-sources'];
    return sources
        ? sources
              .split(',')
              ?.map((s: string) => s.trim())
              .filter((s: any) => diagnosticSources.includes(s))
        : diagnosticSources;
}

const thresholds = ['warning', 'error'] as const;
type Threshold = (typeof thresholds)[number];

function getThreshold(opts: Record<string, any>): Threshold {
    if (thresholds.includes(opts.threshold)) {
        return opts.threshold;
    } else {
        console.warn(`Invalid threshold "${opts.threshold}", using "warning" instead`);
        return 'warning';
    }
}
