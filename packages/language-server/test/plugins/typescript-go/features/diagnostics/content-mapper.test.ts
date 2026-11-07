import ts from 'typescript';
import assert from 'node:assert';
import {
    existsSync,
    readdirSync,
    readFileSync,
    statSync,
    unlinkSync,
    writeFileSync
} from 'node:fs';
import path from 'node:path';
import {
    Diagnostic,
    DiagnosticTag,
    DocumentDiagnosticParams,
    DocumentDiagnosticReport,
    DocumentDiagnosticRequest
} from 'vscode-languageserver';
import { getPackageInfo } from '../../../../../src/importPackage';
import { Document } from '../../../../../src/lib/documents';
import { TemplateASTParseLoader } from '../../../../../src/plugins/svelte/TemplateASTLoader';
import { getScriptKindFromAttributes } from '../../../../../src/plugins/typescript/utils';
import { TsgoResponseTransformer } from '../../../../../src/plugins/typescript-go/middleware';
import { TsApiService } from '../../../../../src/plugins/typescript-go/TsApiService';
import { normalizePath, pathToUrl } from '../../../../../src/utils';
import { createJsonSnapshotFormatter } from '../../../typescript/test-utils';
import {
    createTsApiServiceForTest,
    createTsGoServiceForTest,
    isSvelte5Plus,
    TsGoServiceSetupResult
} from '../../test-utils';

/**
 * The TS6 diagnostics fixtures, run through TS7 in content mapper mode, end to end ("what the user
 * sees"): TS7's pull diagnostics (svelte2tsx inside `@sveltejs/ts-content-mapper`, span maps,
 * diagnostic directives), then the post-processing of the editor middleware
 * (`TsgoResponseTransformer`, which places problems in unmapped virtual code through the TS7 API).
 *
 * The expectation is TS6's (`expectedv2.json` / `expected_svelte_N.json`, or `expected_tsgo*.json`
 * for differences that come from TS7 itself and also apply to `svelte-check --tsgo`).
 * Differences of content mapper mode live in `expected_tsgo_content_mapper.json` next to the
 * fixture, each listed with its reason in `content-mapper-overrides.md`. `--auto` writes them, and
 * removes the ones that are no longer needed. TS6's files are never written.
 *
 * `fixtures` next to this file has cases the TS6 fixtures don't cover. Their `expectedv2.json` is
 * what TS6 reports for them. They're about svelte2tsx's output, so TS7 must report the same without
 * the middleware, too (as `tsc` or svelte-check would).
 */

/**
 * `name`: how test names and `content-mapper-overrides.md` refer to the fixtures.
 * `raw`: TS7's own result must match, too
 */
const fixtureRoots = [
    {
        name: 'fixtures',
        dir: path.join(__dirname, '../../../typescript/features/diagnostics/fixtures'),
        raw: false
    },
    { name: 'typescript-go/fixtures', dir: path.join(__dirname, 'fixtures'), raw: true }
];
const reasonsFile = path.join(__dirname, 'content-mapper-overrides.md');

const {
    version: { major }
} = getPackageInfo('svelte', __dirname);
const expected = 'expectedv2.json';
const newSvelteMajorExpected = `expected_svelte_${major}.json`;
const expectedTsGo = 'expected_tsgo.json';
const newSvelteMajorExpectedTsGo = `expected_tsgo_svelte_${major}.json`;
const contentMapperExpected = 'expected_tsgo_content_mapper.json';

/** "Virtual code produced by the content mapper '...' has problems with no corresponding location" */
const VIRTUAL_CODE_PROBLEMS = 18080;

// Content mapper mode targets Svelte 5 first. The mapper uses the fixtures' Svelte, so the
// overrides only apply to the Svelte version they were created with.
(isSvelte5Plus ? describe : describe.skip)('diagnostics (content-mapper)', function () {
    this.timeout(30_000);

    let services: TsGoServiceSetupResult;
    let api: TsApiService;
    let transformer: TsgoResponseTransformer;

    before(async function () {
        // the first request also starts the mapper process and type checks the svelte shims
        this.timeout(60_000);
        services = await createTsGoServiceForTest(
            fixtureRoots.map((root) => root.dir),
            {
                textDocument: {
                    publishDiagnostics: {
                        relatedInformation: true,
                        tagSupport: {
                            valueSet: [DiagnosticTag.Unnecessary, DiagnosticTag.Deprecated]
                        }
                    }
                }
            }
        );
        api = await createTsApiServiceForTest(services.service, services.lsConfigManager);
        transformer = new TsgoResponseTransformer(
            services.docManager,
            new TemplateASTParseLoader(services.docManager),
            { findDocumentHighlight: async () => null },
            api
        );
    });

    after(async () => {
        await api?.dispose().catch(() => {});
        services?.service.dispose();
    });

    for (const root of fixtureRoots) {
        executeTests(root.name, root.dir, root.raw, () => ({ services, transformer }));
    }

    // in a describe of its own so that it runs after the fixtures (`--auto` creates overrides)
    describe('overrides', () => {
        it('has a reason for each override', () => {
            const reasons = readFileSync(reasonsFile, 'utf-8');
            const overrides = fixtureRoots.flatMap((root) =>
                findOverrides(root.dir).map((dir) =>
                    normalizePath(path.join(root.name, path.relative(root.dir, dir)))
                )
            );
            const missing = overrides.filter((name) => !reasons.includes('`' + name + '`'));
            assert.deepStrictEqual(missing, [], `add the reason to ${reasonsFile}`);
        });
    });
});

function executeTests(
    name: string,
    dir: string,
    raw: boolean,
    getContext: () => { services: TsGoServiceSetupResult; transformer: TsgoResponseTransformer }
) {
    const inputFile = path.join(dir, 'input.svelte');
    if (existsSync(inputFile)) {
        const _it = dir.endsWith('.only') ? it.only : it;
        _it(name, async () => {
            const { services, transformer } = getContext();
            await executeTest(inputFile, dir, raw, services, transformer);
        });
        return;
    }

    const _describe = dir.endsWith('.only') ? describe.only : describe;
    _describe(name, function () {
        for (const subDir of readdirSync(dir)) {
            if (statSync(path.join(dir, subDir)).isDirectory()) {
                executeTests(`${name}/${subDir}`, path.join(dir, subDir), raw, getContext);
            }
        }
    });
}

async function executeTest(
    inputFile: string,
    dir: string,
    checkRaw: boolean,
    services: TsGoServiceSetupResult,
    transformer: TsgoResponseTransformer
) {
    const document = services.docManager.openClientDocument({
        uri: pathToUrl(inputFile),
        text: ts.sys.readFile(inputFile) || ''
    });
    const { diagnostics, raw } = await getDiagnostics(document, services, transformer);

    const sharedExpectedFile =
        [
            path.join(dir, newSvelteMajorExpectedTsGo),
            path.join(dir, newSvelteMajorExpected),
            path.join(dir, expectedTsGo)
        ].find(existsSync) ?? path.join(dir, expected);
    const overrideFile = path.join(dir, contentMapperExpected);
    const auto = process.argv.includes('--auto');
    const matches = (file: string) => {
        try {
            assertSameDiagnostics(diagnostics, file);
            return true;
        } catch {
            return false;
        }
    };

    if (!existsSync(overrideFile)) {
        if (auto && !matches(sharedExpectedFile)) {
            const format = await createJsonSnapshotFormatter(dir);
            writeFileSync(overrideFile, await format(diagnostics), 'utf-8');
            console.info(`Created ${overrideFile}, add the reason to ${reasonsFile}`);
            return;
        }
        assertSameDiagnostics(diagnostics, sharedExpectedFile);
        if (checkRaw) {
            assertSameDiagnostics(raw, sharedExpectedFile);
        }
        return;
    }

    if (matches(sharedExpectedFile)) {
        if (auto) {
            unlinkSync(overrideFile);
            console.info(`Removed ${overrideFile}, remove its reason from ${reasonsFile}`);
            return;
        }
        assert.fail(
            `${overrideFile} is no longer needed, the result matches ${sharedExpectedFile}. ` +
                `Remove it and its reason in ${reasonsFile}`
        );
    }
    if (auto && !matches(overrideFile)) {
        const format = await createJsonSnapshotFormatter(dir);
        writeFileSync(overrideFile, await format(diagnostics), 'utf-8');
        console.info(`Updated ${overrideFile}`);
        return;
    }
    assertSameDiagnostics(diagnostics, overrideFile);
}

function assertSameDiagnostics(actual: Diagnostic[], expectedFile: string) {
    const expectedDiagnostics: Diagnostic[] = JSON.parse(readFileSync(expectedFile, 'utf-8'));
    assert.deepStrictEqual(
        sortDiagnostics(actual),
        sortDiagnostics(expectedDiagnostics.map(normalizeExpected)),
        `expected: ${expectedFile}`
    );
}

/**
 * What the user sees: TS7's pull diagnostics after the middleware's post-processing.
 * And TS7's own result (`raw`)
 */
async function getDiagnostics(
    document: Document,
    { service }: TsGoServiceSetupResult,
    transformer: TsgoResponseTransformer
): Promise<{ diagnostics: Diagnostic[]; raw: Diagnostic[] }> {
    const params: DocumentDiagnosticParams = { textDocument: { uri: document.uri } };
    const raw = await service.sendRequest(DocumentDiagnosticRequest.type, params);
    if (raw.kind !== 'full') {
        throw new Error('Unexpected response format');
    }
    const rawItems = structuredClone(raw.items);
    const report = (await transformer.transform({
        method: DocumentDiagnosticRequest.method,
        params,
        result: raw
    })) as DocumentDiagnosticReport;
    if (report.kind !== 'full') {
        throw new Error('Unexpected response format');
    }

    // TS6's snapshots have 'ts' or 'js' as the source, depending on the script kind
    const source = [
        getScriptKindFromAttributes(document.scriptInfo?.attributes ?? {}),
        getScriptKindFromAttributes(document.moduleScriptInfo?.attributes ?? {})
    ].includes(ts.ScriptKind.TSX)
        ? 'ts'
        : 'js';

    const toSnapshotFormat = (item: Diagnostic): Diagnostic => ({
        range: item.range,
        severity: item.severity,
        source,
        message: withRelatedInformation(item),
        code: item.code,
        tags: item.tags ?? []
    });
    for (const item of report.items) {
        assert.strictEqual(item.source, 'ts', `unexpected source of ${JSON.stringify(item)}`);
    }
    return {
        diagnostics: report.items.map(toSnapshotFormat),
        raw: rawItems.map(toSnapshotFormat)
    };
}

/** The problems in unmapped virtual code (18080) are only in its related information */
function withRelatedInformation(diagnostic: Diagnostic) {
    if (diagnostic.code !== VIRTUAL_CODE_PROBLEMS || !diagnostic.relatedInformation?.length) {
        return diagnostic.message;
    }
    return [
        diagnostic.message,
        ...diagnostic.relatedInformation.map((info) => `  ${info.message}`)
    ].join('\n');
}

/** Older snapshots have no `tags` */
function normalizeExpected(diagnostic: Diagnostic): Diagnostic {
    return { ...diagnostic, tags: diagnostic.tags ?? [] };
}

/** TS6 and TS7 report in different orders, which the user doesn't see */
function sortDiagnostics(diagnostics: Diagnostic[]) {
    const key = (d: Diagnostic) =>
        JSON.stringify([
            d.range.start.line,
            d.range.start.character,
            d.range.end.line,
            d.range.end.character,
            d.code,
            d.message,
            d.severity,
            d.tags
        ]);
    return [...diagnostics].sort((a, b) => key(a).localeCompare(key(b)));
}

function findOverrides(dir: string): string[] {
    const result: string[] = [];
    for (const entry of readdirSync(dir)) {
        const entryPath = path.join(dir, entry);
        if (statSync(entryPath).isDirectory()) {
            result.push(...findOverrides(entryPath));
        } else if (entry === contentMapperExpected) {
            result.push(dir);
        }
    }
    return result;
}
