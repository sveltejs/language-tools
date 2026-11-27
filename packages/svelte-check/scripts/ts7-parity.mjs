// @ts-check
/**
 * Parity report: today's svelte-check (TypeScript 6) vs. its TypeScript 7 path
 * (`--experimental-ts7`) on any number of projects ("corpora").
 *
 * Compares the errors and warnings of both runs by (file, line, column, code, severity), lists
 * messages that differ separately, and buckets every difference:
 *   kit          SvelteKit route/hooks/params files (implicit typing isn't supported by the TS7 path)
 *   kit-route    `.svelte` route files (+page/+layout/+error), often a consequence of the above
 *   override     in a fixture directory with `expected_tsgo*.json` (a difference documented there)
 *   config       the tsconfig/jsconfig
 *   other        everything else, needs an explanation
 *
 * Usage (from packages/svelte-check, after `pnpm build`):
 *   node scripts/ts7-parity.mjs --corpus tsconfig=<path>[,name=<label>][,ts7-tsconfig=<path>][,mirror] ...
 *     [--sources js|all] [--json <file>] [--strict]
 *     [--typescript <TS 7.1 package dir>] [--mapper <content mapper package dir>]
 *
 *   tsconfig       the project's tsconfig; the TypeScript 6 run uses it as is
 *   ts7-tsconfig   tsconfig for the TS7 run (default: the same). It must map .svelte files, and
 *                  TypeScript 7.1 must resolve from it (as `typescript` or `@typescript/native`)
 *   mirror         run TS7 on a temporary mirror of the project instead: a tsconfig that extends
 *                  the project's and adds the `contentMappers` entry, with node_modules made of
 *                  symlinks to the project's, the content mapper and TypeScript 7.1 (as
 *                  `@typescript/native`). Nothing is written into the project.
 *   --sources      `js` (default) compares TypeScript diagnostics only, `all` also Svelte and CSS
 *   --typescript   TypeScript 7.1 for mirrors (default: svelte-check's `@typescript/native`)
 *   --mapper       content mapper for mirrors (default: svelte-check's `@sveltejs/ts-content-mapper`)
 *   --json         writes all results and differences
 *   --strict       exit code 1 if there are differences in the `other` bucket
 *
 * Example:
 *   node scripts/ts7-parity.mjs --corpus tsconfig=test-error/tsconfig.json,mirror \
 *     --corpus tsconfig=../language-server/test/plugins/typescript/features/diagnostics/fixtures/tsconfig.json,name=ls-fixtures
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const svelteCheckDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(svelteCheckDir, 'dist', 'src', 'index.js');
const CONTENT_MAPPER = '@sveltejs/ts-content-mapper';
const require = createRequire(path.join(svelteCheckDir, 'package.json'));

/** @param {string} packageName */
function packageDir(packageName, from = svelteCheckDir) {
    return fs.realpathSync(
        path.dirname(require.resolve(`${packageName}/package.json`, { paths: [from] }))
    );
}

/**
 * @typedef {{ name: string, tsconfig: string, ts7Tsconfig?: string, mirror: boolean }} Corpus
 * @typedef {{ file: string, line: number, column: number, code: number | string, type: string, message: string, source?: string }} Entry
 */

function parseArgs() {
    const args = process.argv.slice(2);
    /** @type {Corpus[]} */
    const corpora = [];
    const options = {
        sources: 'js',
        json: /** @type {string | undefined} */ (undefined),
        strict: false,
        typescript: /** @type {string | undefined} */ (undefined),
        mapper: /** @type {string | undefined} */ (undefined)
    };
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--corpus') {
            /** @type {Record<string, string | true>} */
            const spec = {};
            for (const part of args[++i].split(',')) {
                const [key, ...value] = part.split('=');
                spec[key] = value.length ? value.join('=') : true;
            }
            if (typeof spec.tsconfig !== 'string') {
                throw new Error(`--corpus needs tsconfig=<path>: ${args[i]}`);
            }
            const tsconfig = path.resolve(spec.tsconfig);
            corpora.push({
                name:
                    typeof spec.name === 'string'
                        ? spec.name
                        : path.basename(path.dirname(tsconfig)),
                tsconfig,
                ts7Tsconfig:
                    typeof spec['ts7-tsconfig'] === 'string'
                        ? path.resolve(spec['ts7-tsconfig'])
                        : undefined,
                mirror: spec.mirror === true
            });
        } else if (arg === '--sources') {
            options.sources = args[++i];
        } else if (arg === '--json') {
            options.json = path.resolve(args[++i]);
        } else if (arg === '--strict') {
            options.strict = true;
        } else if (arg === '--typescript') {
            options.typescript = path.resolve(args[++i]);
        } else if (arg === '--mapper') {
            options.mapper = path.resolve(args[++i]);
        } else {
            throw new Error(`Unknown argument ${arg}`);
        }
    }
    if (!corpora.length) {
        throw new Error('No corpus, see the usage at the top of this file');
    }
    return { corpora, options };
}

/**
 * tsconfig files are JSON with comments and trailing commas
 *
 * @param {string} file
 */
function readJsonc(file) {
    const text = fs.readFileSync(file, 'utf-8');
    let json = '';
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            const end = findStringEnd(text, i);
            json += text.slice(i, end + 1);
            i = end;
        } else if (char === '/' && text[i + 1] === '/') {
            while (i < text.length && text[i] !== '\n') i++;
            json += '\n';
        } else if (char === '/' && text[i + 1] === '*') {
            i = text.indexOf('*/', i + 2) + 1;
        } else {
            json += char;
        }
    }
    return JSON.parse(json.replace(/,(\s*[}\]])/g, '$1'));
}

/** @param {string} text @param {number} start index of the opening quote */
function findStringEnd(text, start) {
    for (let i = start + 1; i < text.length; i++) {
        if (text[i] === '\\') {
            i++;
        } else if (text[i] === '"') {
            return i;
        }
    }
    return text.length;
}

/**
 * A TS7 view of a project without writing into it, see `mirror` in the usage.
 *
 * @param {string} projectTsconfig
 * @param {{ typescript: string, mapper: string }} packages
 */
function createMirror(projectTsconfig, packages) {
    const projectDir = path.dirname(projectTsconfig);
    const raw = readJsonc(projectTsconfig);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svelte-check-ts7-mirror-'));
    const nodeModules = path.join(dir, 'node_modules');
    fs.mkdirSync(nodeModules);

    /** @param {string} name @param {string} target */
    const link = (name, target) => {
        const linkPath = path.join(nodeModules, name);
        fs.mkdirSync(path.dirname(linkPath), { recursive: true });
        fs.rmSync(linkPath, { force: true, recursive: true });
        fs.symlinkSync(target, linkPath, 'junction');
    };

    const projectNodeModules = path.join(projectDir, 'node_modules');
    if (fs.existsSync(projectNodeModules)) {
        for (const entry of fs.readdirSync(projectNodeModules)) {
            // the content mapper writes svelte2tsx's shims there
            if (entry === '.svelte2tsx-language-server-files') {
                continue;
            }
            if (entry.startsWith('@')) {
                for (const scoped of fs.readdirSync(path.join(projectNodeModules, entry))) {
                    link(`${entry}/${scoped}`, path.join(projectNodeModules, entry, scoped));
                }
            } else {
                link(entry, path.join(projectNodeModules, entry));
            }
        }
    }
    link('@typescript/native', packages.typescript);
    if (!fs.existsSync(path.join(nodeModules, CONTENT_MAPPER))) {
        link(CONTENT_MAPPER, packages.mapper);
    }
    if (!fs.existsSync(path.join(nodeModules, 'svelte'))) {
        link('svelte', packageDir('svelte', projectDir));
    }

    /** @type {Record<string, unknown>} */
    const tsconfig = {
        extends: projectTsconfig,
        contentMappers: [{ package: CONTENT_MAPPER, extensions: ['.svelte'] }]
    };
    if (!raw.include && !raw.files) {
        if (raw.extends) {
            console.warn(
                `${projectTsconfig} has no include/files: the mirror relies on the configs it extends to define them`
            );
        } else {
            // the default include would be relative to the mirror
            tsconfig.include = [path.join(projectDir, '**', '*')];
        }
    }
    const mirrorTsconfig = path.join(dir, 'tsconfig.json');
    fs.writeFileSync(mirrorTsconfig, JSON.stringify(tsconfig, null, 4));
    return mirrorTsconfig;
}

/**
 * @param {string} tsconfig
 * @param {string[]} extraArgs
 * @param {string} sources
 */
function runSvelteCheck(tsconfig, extraArgs, sources) {
    const workspace = path.dirname(tsconfig);
    const args = [
        CLI,
        '--workspace',
        workspace,
        '--tsconfig',
        tsconfig,
        '--output',
        'machine-verbose',
        ...(sources === 'js' ? ['--diagnostic-sources', 'js'] : []),
        ...extraArgs
    ];
    const start = performance.now();
    const result = spawnSync(process.execPath, args, {
        encoding: 'utf-8',
        maxBuffer: 256 * 1024 * 1024
    });
    const seconds = (performance.now() - start) / 1000;
    /** @type {Entry[]} */
    const entries = [];
    let failure;
    let summary;
    for (const line of result.stdout.split('\n')) {
        const content = line.replace(/^\d+ /, '');
        if (content.startsWith('FAILURE ')) {
            failure = JSON.parse(content.slice('FAILURE '.length));
        } else if (content.startsWith('COMPLETED ')) {
            summary = content;
        } else if (content.startsWith('{')) {
            const entry = JSON.parse(content);
            entries.push({
                file: path.resolve(workspace, entry.filename),
                line: entry.start.line,
                column: entry.start.character,
                code: entry.code,
                type: entry.type,
                message: entry.message,
                source: entry.source
            });
        }
    }
    if (!summary && !failure) {
        failure = `exit ${result.status}: ${result.stderr.slice(0, 2000)}`;
    }
    return { entries, failure, summary, seconds, status: result.status };
}

/** @param {Entry} entry */
function key(entry) {
    return `${entry.file}:${entry.line}:${entry.column} ${entry.code} ${entry.type}`;
}

/** @param {string} file */
function bucket(file) {
    const base = path.basename(file);
    if (
        /^\+(page|layout|server)(\.server)?\.(ts|js)$/.test(base) ||
        /^hooks(\.server|\.client)?\.(ts|js)$/.test(base) ||
        /[\\/]params[\\/][^\\/]+\.(ts|js)$/.test(file)
    ) {
        return 'kit';
    }
    if (/^\+(page|layout|error)(@[^.]*)?\.svelte$/.test(base)) {
        return 'kit-route';
    }
    if (/^(ts|js)config.*\.json$/.test(base)) {
        return 'config';
    }
    const fixtureOverride = findOverride(path.dirname(file));
    if (fixtureOverride) {
        return `override (${fixtureOverride})`;
    }
    return 'other';
}

/** @param {string} dir */
function findOverride(dir) {
    for (let current = dir; ; current = path.dirname(current)) {
        if (!fs.existsSync(current) || current === path.dirname(current)) {
            return undefined;
        }
        const files = fs.readdirSync(current);
        if (files.includes('expected_tsgo_content_mapper.json')) {
            return 'expected_tsgo_content_mapper.json';
        }
        const tsgo = files.find((name) => /^expected_tsgo.*\.json$/.test(name));
        if (tsgo) {
            return tsgo;
        }
        if (files.includes('tsconfig.json') || files.includes('package.json')) {
            return undefined;
        }
    }
}

function main() {
    const { corpora, options } = parseArgs();
    const packages = {
        typescript: options.typescript ?? packageDir('@typescript/native'),
        mapper: options.mapper ?? packageDir(CONTENT_MAPPER)
    };
    const report = [];
    let otherDifferences = 0;

    for (const corpus of corpora) {
        const ts7Tsconfig = corpus.mirror
            ? createMirror(corpus.tsconfig, packages)
            : (corpus.ts7Tsconfig ?? corpus.tsconfig);
        try {
            const ts6 = runSvelteCheck(corpus.tsconfig, [], options.sources);
            const ts7 = runSvelteCheck(ts7Tsconfig, ['--experimental-ts7'], options.sources);

            const relative = (/** @type {string} */ file) =>
                path.relative(path.dirname(corpus.tsconfig), file).replace(/\\/g, '/');
            const ts6Keys = new Map(ts6.entries.map((entry) => [key(entry), entry]));
            const ts7Keys = new Map(ts7.entries.map((entry) => [key(entry), entry]));
            const differences = [
                ...ts6.entries
                    .filter((entry) => !ts7Keys.has(key(entry)))
                    .map((entry) => ({ side: 'TS6 only', ...entry })),
                ...ts7.entries
                    .filter((entry) => !ts6Keys.has(key(entry)))
                    .map((entry) => ({ side: 'TS7 only', ...entry }))
            ].map((difference) => ({ ...difference, bucket: bucket(difference.file) }));
            const messageDifferences = ts6.entries
                .filter((entry) => {
                    const ts7Entry = ts7Keys.get(key(entry));
                    return ts7Entry && ts7Entry.message !== entry.message;
                })
                .map((entry) => ({ ...entry, ts7Message: ts7Keys.get(key(entry))?.message }));
            otherDifferences += differences.filter((d) => d.bucket === 'other').length;

            console.log(`\n## ${corpus.name}`);
            console.log(
                `TS6: ${ts6.failure ? 'FAILURE ' + ts6.failure : ts6.summary} (${ts6.seconds.toFixed(1)} s)`
            );
            console.log(
                `TS7: ${ts7.failure ? 'FAILURE ' + ts7.failure : ts7.summary} (${ts7.seconds.toFixed(1)} s)`
            );
            console.log(
                `errors/warnings: TS6 ${ts6.entries.length}, TS7 ${ts7.entries.length}, same ${
                    ts6.entries.length - differences.filter((d) => d.side === 'TS6 only').length
                }, TS6 only ${differences.filter((d) => d.side === 'TS6 only').length}, TS7 only ${
                    differences.filter((d) => d.side === 'TS7 only').length
                }, same position but different message ${messageDifferences.length}`
            );
            /** @type {Map<string, typeof differences>} */
            const byBucket = new Map();
            for (const difference of differences) {
                byBucket.set(difference.bucket, [
                    ...(byBucket.get(difference.bucket) ?? []),
                    difference
                ]);
            }
            for (const [name, entries] of [...byBucket].sort(([a], [b]) => a.localeCompare(b))) {
                console.log(`\n  ${name}: ${entries.length}`);
                for (const d of entries) {
                    console.log(
                        `    ${d.side}  ${relative(d.file)}:${d.line + 1}:${d.column + 1}  ${d.type} ${d.code}  ${d.message.split('\n')[0].slice(0, 120)}`
                    );
                }
            }
            if (messageDifferences.length) {
                console.log(`\n  same position, different message: ${messageDifferences.length}`);
                for (const d of messageDifferences) {
                    console.log(`    ${relative(d.file)}:${d.line + 1}:${d.column + 1}  ${d.code}`);
                }
            }
            report.push({
                corpus,
                ts7Tsconfig,
                ts6: { summary: ts6.summary, failure: ts6.failure, seconds: ts6.seconds },
                ts7: { summary: ts7.summary, failure: ts7.failure, seconds: ts7.seconds },
                differences,
                messageDifferences
            });
        } finally {
            if (corpus.mirror) {
                fs.rmSync(path.dirname(ts7Tsconfig), { recursive: true, force: true });
            }
        }
    }

    if (options.json) {
        fs.writeFileSync(options.json, JSON.stringify(report, null, 2));
    }
    if (options.strict && otherDifferences) {
        process.exitCode = 1;
    }
}

main();
