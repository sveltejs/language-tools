import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'node:util';
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
    const options = {
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
        workspace: { type: 'string' },
        output: { type: 'string', default: 'human-verbose' },
        watch: { type: 'boolean' },
        preserveWatchOutput: { type: 'boolean' },
        tsconfig: { type: 'string' },
        'no-tsconfig': { type: 'boolean' },
        ignore: { type: 'string' },
        'fail-on-warnings': { type: 'boolean' },
        'compiler-warnings': { type: 'string' },
        'diagnostic-sources': { type: 'string' },
        threshold: { type: 'string', default: 'warning' },
        color: { type: 'boolean' },
        'no-color': { type: 'boolean' }
    } as const;

    try {
        const { values } = parseArgs({
            args: process.argv.slice(2),
            options,
            strict: false
        });

        if (values.help) {
            showHelp();
            process.exit(0);
        }

        if (values.version) {
            console.log(require('../../package.json').version);
            process.exit(0);
        }

        const workspaceUri = getWorkspaceUri(values);
        const tsconfig = getTsconfig(values, workspaceUri.fsPath);

        if (values.ignore && tsconfig) {
            throwError('`--ignore` only has an effect when using `--no-tsconfig`');
        }

        cb({
            workspaceUri,
            outputFormat: getOutputFormat(values),
            watch: !!values.watch,
            preserveWatchOutput: !!values.preserveWatchOutput,
            tsconfig,
            filePathsToIgnore: typeof values.ignore === 'string' ? values.ignore.split(',') : [],
            failOnWarnings: !!values['fail-on-warnings'],
            compilerWarnings: getCompilerWarnings(values),
            diagnosticSources: getDiagnosticSources(values),
            threshold: getThreshold(values)
        });
    } catch (error: any) {
        console.error(`Error parsing arguments: ${error.message}`);
        process.exit(1);
    }
}

function showHelp() {
    const packageJson = require('../../package.json');
    console.log(`${packageJson.name} v${packageJson.version}`);
    console.log(`${packageJson.description}`);
    console.log('');
    console.log('Usage: svelte-check [options]');
    console.log('');
    console.log('Options:');
    console.log('  -h, --help                          Show help');
    console.log('  -v, --version                       Show version');
    console.log('  --workspace <path>                  Path to your workspace. All subdirectories except node_modules and those listed in `--ignore` are checked. Defaults to current working directory.');
    console.log('  --output <format>                   What output format to use. Options are human, human-verbose, machine, machine-verbose. (default: "human-verbose")');
    console.log('  --watch                             Will not exit after one pass but keep watching files for changes and rerun diagnostics');
    console.log('  --preserveWatchOutput               Do not clear the screen in watch mode');
    console.log('  --tsconfig <path>                   Pass a path to a tsconfig or jsconfig file. The path can be relative to the workspace path or absolute.');
    console.log('  --no-tsconfig                       Use this if you only want to check the Svelte files found in the current directory and below and ignore any JS/TS files');
    console.log('  --ignore <patterns>                 Only has an effect when using `--no-tsconfig` option. Files/folders to ignore - relative to workspace root, comma-separated, inside quotes.');
    console.log('  --fail-on-warnings                  Will also exit with error code when there are warnings');
    console.log('  --compiler-warnings <list>          A list of Svelte compiler warning codes. Each entry defines whether that warning should be ignored or treated as an error.');
    console.log('  --diagnostic-sources <list>         A list of diagnostic sources which should run diagnostics on your code. Possible values are `js` (includes TS), `svelte`, `css`.');
    console.log('  --threshold <level>                 Filters the diagnostics to display. `error` will output only errors while `warning` will output warnings and errors. (default: "warning")');
    console.log('  --color                             Force enabling of color output');
    console.log('  --no-color                          Force disabling of color output');
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
        : [...diagnosticSources];
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
