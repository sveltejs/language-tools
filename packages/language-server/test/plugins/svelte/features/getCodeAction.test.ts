import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { EOL } from 'os';
import { CodeActionContext, CodeAction, Range, DiagnosticSeverity } from 'vscode-languageserver';
import { getCodeActions } from '../../../../src/plugins/svelte/features/getCodeActions';
import { SvelteDocument } from '../../../../src/plugins/svelte/SvelteDocument';
import { Document } from '../../../../src/lib/documents';
import { pathToUrl } from '../../../../src/utils';

describe('SveltePlugin#getCodeAction', () => {
    const testDir = path.join(__dirname, '..', 'testfiles');
    function getFullPath(filename: string) {
        return path.join(testDir, filename);
    }
    function getUri(filename: string) {
        return pathToUrl(getFullPath(filename));
    }
    function expectCodeActionFor(
        filename: string,
        context: CodeActionContext,
    ) {
        const filePath = path.join(testDir, filename);
        const document = new Document(
            pathToUrl(filePath),
            filename ? fs.readFileSync(filePath)?.toString() : ''
        );
        const svelteDoc = new SvelteDocument(document);
        const codeAction = getCodeActions(svelteDoc, context);
        return {
            toEqual: (expected: CodeAction[]) =>
                assert.deepStrictEqual(
                    codeAction,
                    expected,
                ),
        };
    }

    describe('It should not provide svelte ignore code actions', () => {
        const startRange: Range = Range.create(
            { line: 0, character: 0 },
            { line: 0, character: 1 }
        );
        it('if no svelte diagnostic', () => {
            expectCodeActionFor('', {
                diagnostics: [{
                    code: 'whatever',
                    source: 'eslint',
                    range: startRange,
                    message: ''
                }]
            }).toEqual([]);
        });

        it('if no diagnostic code', () => {
            expectCodeActionFor('', {
                diagnostics: [{
                    source: 'svelte',
                    range: startRange,
                    message: ''
                }]
            }).toEqual([]);
        });

        it('if diagnostic is error', () => {
            expectCodeActionFor('', {
                diagnostics: [{
                    source: 'svelte',
                    range: startRange,
                    message: '',
                    severity: DiagnosticSeverity.Error
                }]
            }).toEqual([]);
        });
    });

    describe('It should provide svelte ignore code actions ', () => {
        const svelteIgnoreCodeAction = 'svelte-ignore-code-action.svelte';

        it('should provide ignore comment', () => {
            expectCodeActionFor(svelteIgnoreCodeAction, {
                diagnostics: [{
                    severity: DiagnosticSeverity.Warning,
                    code: 'a11y-missing-attribute',
                    range: Range.create(
                        { line: 0, character: 0 },
                        { line: 0, character: 6 }
                    ),
                    message: '',
                    source: 'svelte'
                }]
            }).toEqual([{
                edit: {
                    documentChanges: [
                        {
                            edits: [
                                {
                                    newText: `<!-- svelte-ignore a11y-missing-attribute -->${EOL}`,
                                    range: {
                                        end: {
                                            character: 0,
                                            line: 0,
                                        },
                                        start: {
                                            character: 0,
                                            line: 0
                                        }
                                    }
                                }
                            ],
                            textDocument: {
                                uri: getUri(svelteIgnoreCodeAction),
                                version: 0
                            },
                        },
                    ],
                },
                title: '(svelte) Disable a11y-missing-attribute for this line',
                kind: 'quickfix'
            }]);
        });

        it('should provide ignore comment with indent', () => {
            expectCodeActionFor(svelteIgnoreCodeAction, {
                diagnostics: [{
                    severity: DiagnosticSeverity.Warning,
                    code: 'a11y-missing-attribute',
                    range: Range.create(
                        { line: 3, character: 4 },
                        { line: 3, character: 11 }
                    ),
                    message: '',
                    source: 'svelte'
                }]
            }).toEqual([{
                edit: {
                    documentChanges: [
                        {
                            edits: [
                                {
                                    newText:
                                        `${' '.repeat(4)}<!-- svelte-ignore a11y-missing-attribute -->${EOL}`,
                                    range: {
                                        end: {
                                            character: 0,
                                            line: 3,
                                        },
                                        start: {
                                            character: 0,
                                            line: 3
                                        }
                                    }
                                }
                            ],
                            textDocument: {
                                uri: getUri(svelteIgnoreCodeAction),
                                version: 0
                            },
                        },
                    ],
                },
                title: '(svelte) Disable a11y-missing-attribute for this line',
                kind: 'quickfix'
            }]);
        });

        it('should provide ignore comment with indent of parent tag', () => {
            expectCodeActionFor(svelteIgnoreCodeAction, {
                diagnostics: [{
                    severity: DiagnosticSeverity.Warning,
                    code: 'a11y-invalid-attribute',
                    range: Range.create(
                        { line: 6, character: 8 },
                        { line: 6, character: 15 }
                    ),
                    message: '',
                    source: 'svelte'
                }]
            }).toEqual([{
                edit: {
                    documentChanges: [
                        {
                            edits: [
                                {
                                    newText:
                                        `${' '.repeat(4)}<!-- svelte-ignore a11y-invalid-attribute -->${EOL}`,
                                    range: {
                                        end: {
                                            character: 0,
                                            line: 5,
                                        },
                                        start: {
                                            character: 0,
                                            line: 5
                                        }
                                    }
                                }
                            ],
                            textDocument: {
                                uri: getUri(svelteIgnoreCodeAction),
                                version: 0
                            },
                        },
                    ],
                },
                title: '(svelte) Disable a11y-invalid-attribute for this line',
                kind: 'quickfix'
            }]);
        });
    });
});
