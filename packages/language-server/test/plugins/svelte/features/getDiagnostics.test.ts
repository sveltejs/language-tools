import * as assert from 'assert';
import { Diagnostic, DiagnosticSeverity, Position } from 'vscode-languageserver';
import { Document } from '../../../../src/lib/documents';
import { getDiagnostics } from '../../../../src/plugins/svelte/features/getDiagnostics';
import {
    SvelteDocument,
    TranspileErrorSource,
} from '../../../../src/plugins/svelte/SvelteDocument';
import { SvelteConfig } from '../../../../src/lib/documents/configLoader';
import { CompilerWarningsSettings } from '../../../../src/ls-config';

describe('SveltePlugin#getDiagnostics', () => {
    async function expectDiagnosticsFor(
        getTranspiled: any,
        getCompiled: any,
        config: Partial<SvelteConfig>,
        settings: CompilerWarningsSettings = {},
    ) {
        const document = new Document('', '<script></script>\n<style></style>');
        const svelteDoc: SvelteDocument = <any>{ getTranspiled, getCompiled, config };
        const result = await getDiagnostics(document, svelteDoc, settings);
        return {
            toEqual: (expected: Diagnostic[]) => assert.deepStrictEqual(result, expected),
        };
    }

    it('expect svelte.config.js error', async () => {
        (
            await expectDiagnosticsFor(
                () => {
                    throw new Error();
                },
                () => '',
                { loadConfigError: new Error('svelte.config.js') },
            )
        ).toEqual([
            {
                message: 'Error in svelte.config.js\n\nError: svelte.config.js',
                range: {
                    start: {
                        character: 0,
                        line: 0,
                    },
                    end: {
                        character: 5,
                        line: 0,
                    },
                },
                severity: DiagnosticSeverity.Error,
                source: 'svelte',
            },
        ]);
    });

    it('expect script transpilation error', async () => {
        (
            await expectDiagnosticsFor(
                () => {
                    const e: any = new Error('Script');
                    e.__source = TranspileErrorSource.Script;
                    throw e;
                },
                () => '',
                {},
            )
        ).toEqual([
            {
                message: 'Script',
                range: {
                    start: {
                        character: 8,
                        line: 0,
                    },
                    end: {
                        character: 8,
                        line: 0,
                    },
                },
                severity: DiagnosticSeverity.Error,
                source: 'svelte(script)',
            },
        ]);
    });

    it('expect style transpilation error', async () => {
        (
            await expectDiagnosticsFor(
                () => {
                    const e: any = new Error('Style');
                    e.__source = TranspileErrorSource.Style;
                    throw e;
                },
                () => '',
                {},
            )
        ).toEqual([
            {
                message: 'Style',
                range: {
                    start: {
                        character: 7,
                        line: 1,
                    },
                    end: {
                        character: 7,
                        line: 1,
                    },
                },
                severity: DiagnosticSeverity.Error,
                source: 'svelte(style)',
            },
        ]);
    });

    it('expect style transpilation error with line/columns', async () => {
        (
            await expectDiagnosticsFor(
                () => {
                    const e: any = new Error('Style');
                    e.line = 1;
                    e.column = 0;
                    e.__source = TranspileErrorSource.Style;
                    throw e;
                },
                () => '',
                {},
            )
        ).toEqual([
            {
                message: 'Style',
                range: {
                    start: {
                        character: 0,
                        line: 1,
                    },
                    end: {
                        character: 0,
                        line: 1,
                    },
                },
                severity: DiagnosticSeverity.Error,
                source: 'svelte(style)',
            },
        ]);
    });

    it('expect compilation error', async () => {
        (
            await expectDiagnosticsFor(
                () => ({
                    getOriginalPosition: () => Position.create(0, 0),
                }),
                () => {
                    const e: any = new Error('Compilation');
                    e.message = 'ERROR';
                    e.code = 123;
                    throw e;
                },
                {},
            )
        ).toEqual([
            {
                code: 123,
                message: 'ERROR',
                range: {
                    start: {
                        character: 0,
                        line: 0,
                    },
                    end: {
                        character: 0,
                        line: 0,
                    },
                },
                severity: DiagnosticSeverity.Error,
                source: 'svelte',
            },
        ]);
    });

    it('expect compilation error with expected', async () => {
        (
            await expectDiagnosticsFor(
                () => ({
                    getOriginalPosition: () => Position.create(0, 8),
                }),
                () => {
                    const e: any = new Error('Compilation');
                    e.message = 'expected x to not be here';
                    e.code = 123;
                    e.start = { line: 1, column: 8 };
                    throw e;
                },
                {},
            )
        ).toEqual([
            {
                code: 123,
                message:
                    'expected x to not be here' +
                    '\n\nIf you expect this syntax to work, here are some suggestions: ' +
                    '\nIf you use typescript with `svelte-preprocess`, did you add `lang="typescript"` to your `script` tag? ' +
                    '\nDid you setup a `svelte.config.js`? ' +
                    '\nSee https://github.com/sveltejs/language-tools/tree/master/packages/svelte-vscode#using-with-preprocessors for more info.',
                range: {
                    start: {
                        character: 8,
                        line: 0,
                    },
                    end: {
                        character: 8,
                        line: 0,
                    },
                },
                severity: DiagnosticSeverity.Error,
                source: 'svelte',
            },
        ]);
    });

    it('expect warnings', async () => {
        (
            await expectDiagnosticsFor(
                () => ({
                    getOriginalPosition: (pos: Position) => {
                        pos.line - 1;
                        return pos;
                    },
                }),
                () =>
                    Promise.resolve({
                        stats: {
                            warnings: [
                                {
                                    start: { line: 1, column: 0 },
                                    end: { line: 1, column: 0 },
                                    message: 'warning',
                                    code: 123,
                                },
                            ],
                        },
                    }),
                {},
            )
        ).toEqual([
            {
                code: 123,
                message: 'warning',
                range: {
                    start: {
                        character: 0,
                        line: 0,
                    },
                    end: {
                        character: 0,
                        line: 0,
                    },
                },
                severity: DiagnosticSeverity.Warning,
                source: 'svelte',
            },
        ]);
    });

    it('filter out warnings', async () => {
        (
            await expectDiagnosticsFor(
                () => ({
                    getOriginalPosition: (pos: Position) => {
                        pos.line - 1;
                        return pos;
                    },
                }),
                () =>
                    Promise.resolve({
                        stats: {
                            warnings: [
                                {
                                    start: { line: 1, column: 0 },
                                    end: { line: 1, column: 0 },
                                    message: 'warning',
                                    code: '123',
                                },
                            ],
                        },
                    }),
                {},
                { '123': 'ignore' },
            )
        ).toEqual([]);
    });

    it('treat warnings as error', async () => {
        (
            await expectDiagnosticsFor(
                () => ({
                    getOriginalPosition: (pos: Position) => {
                        pos.line - 1;
                        return pos;
                    },
                }),
                () =>
                    Promise.resolve({
                        stats: {
                            warnings: [
                                {
                                    start: { line: 1, column: 0 },
                                    end: { line: 1, column: 0 },
                                    message: 'warning',
                                    code: '123',
                                },
                            ],
                        },
                    }),
                {},
                { '123': 'error' },
            )
        ).toEqual([
            {
                code: '123',
                message: 'warning',
                range: {
                    start: {
                        character: 0,
                        line: 0,
                    },
                    end: {
                        character: 0,
                        line: 0,
                    },
                },
                severity: DiagnosticSeverity.Error,
                source: 'svelte',
            },
        ]);
    });
});
