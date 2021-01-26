import * as assert from 'assert';
import * as path from 'path';
import ts from 'typescript';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { LSConfigManager } from '../../../../src/ls-config';
import { TypeScriptPlugin } from '../../../../src/plugins';
import { pathToUrl } from '../../../../src/utils';

describe('DiagnosticsProvider', () => {
    function setup(filename: string) {
        const docManager = new DocumentManager(() => document);
        const testDir = path.join(__dirname, '..');
        const filePath = path.join(testDir, 'testfiles', filename);
        const document = new Document(pathToUrl(filePath), ts.sys.readFile(filePath)!);
        const pluginManager = new LSConfigManager();
        const plugin = new TypeScriptPlugin(docManager, pluginManager, [pathToUrl(testDir)]);
        docManager.openDocument(<any>'some doc');
        return { plugin, document };
    }

    it('provides diagnostics', async () => {
        const { plugin, document } = setup('diagnostics.svelte');
        const diagnostics = await plugin.getDiagnostics(document);

        assert.deepStrictEqual(diagnostics, [
            {
                code: 2322,
                message: "Type 'boolean' is not assignable to type 'string'.",
                range: {
                    start: {
                        character: 32,
                        line: 0
                    },
                    end: {
                        character: 35,
                        line: 0
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            }
        ]);
    });

    it('provides diagnostics for context="module"', async () => {
        const { plugin, document } = setup('diagnostics-module.svelte');
        const diagnostics = await plugin.getDiagnostics(document);

        assert.deepStrictEqual(diagnostics, [
            {
                code: 2322,
                message: "Type 'boolean' is not assignable to type 'string'.",
                range: {
                    start: {
                        character: 49,
                        line: 0
                    },
                    end: {
                        character: 52,
                        line: 0
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            }
        ]);
    });

    it('provides typecheck diagnostics for js file when //@ts-check at top of script', async () => {
        const { plugin, document } = setup('diagnostics-js-typecheck.svelte');
        const diagnostics = await plugin.getDiagnostics(document);

        assert.deepStrictEqual(diagnostics, [
            {
                code: 2339,
                message: "Property 'bla' does not exist on type '1'.",
                range: {
                    start: {
                        character: 4,
                        line: 3
                    },
                    end: {
                        character: 7,
                        line: 3
                    }
                },
                severity: 1,
                source: 'js',
                tags: []
            }
        ]);
    });

    it('provides diagnostics for wrong $store usage', async () => {
        const { plugin, document } = setup('diagnostics-$store.svelte');
        const diagnostics = await plugin.getDiagnostics(document);

        assert.deepStrictEqual(diagnostics, [
            {
                code: 2345,
                message:
                    "Argument of type 'string' is not assignable to parameter of type 'SvelteStore<any>'.",
                range: {
                    end: {
                        character: 6,
                        line: 2
                    },
                    start: {
                        character: 1,
                        line: 2
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2345,
                message:
                    "Argument of type 'string' is not assignable to parameter of type 'SvelteStore<any>'.",
                range: {
                    end: {
                        character: 9,
                        line: 3
                    },
                    start: {
                        character: 4,
                        line: 3
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2345,
                message:
                    "Argument of type 'string' is not assignable to parameter of type 'SvelteStore<any>'.",
                range: {
                    end: {
                        character: 7,
                        line: 6
                    },
                    start: {
                        character: 2,
                        line: 6
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2345,
                message:
                    "Argument of type 'string' is not assignable to parameter of type 'SvelteStore<any>'.",
                range: {
                    end: {
                        character: 11,
                        line: 7
                    },
                    start: {
                        character: 6,
                        line: 7
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            }
        ]);
    });

    it('provides no typecheck diagnostics for js file', async () => {
        const { plugin, document } = setup('diagnostics-js-notypecheck.svelte');
        const diagnostics = await plugin.getDiagnostics(document);

        assert.deepStrictEqual(diagnostics, []);
    });

    it('provides diagnostics when there is a parser error', async () => {
        const { plugin, document } = setup('diagnostics-parsererror.svelte');
        const diagnostics = await plugin.getDiagnostics(document);

        assert.deepStrictEqual(diagnostics, [
            {
                code: -1,
                message: 'You can only have one top-level <style> tag per component',
                range: {
                    start: {
                        character: 0,
                        line: 1
                    },
                    end: {
                        character: 0,
                        line: 1
                    }
                },
                severity: 1,
                source: 'js'
            }
        ]);
    });

    it('ignore false positives', async () => {
        const { plugin, document } = setup('diagnostics-falsepositives.svelte');
        const diagnostics = await plugin.getDiagnostics(document);

        assert.deepStrictEqual(diagnostics, []);
    });

    it('handles svelte native syntax', async () => {
        const { plugin, document } = setup('svelte-native/svelte-native.svelte');
        const diagnostics = await plugin.getDiagnostics(document);
        assert.deepStrictEqual(diagnostics, []);
    });

    it('provide diagnostics tags', async () => {
        const { plugin, document } = setup('diagnostics-tag.svelte');
        const diagnostics = await plugin.getDiagnostics(document);

        assert.deepStrictEqual(diagnostics, [
            {
                code: 6385,
                message: "'a' is deprecated",
                range: {
                    end: {
                        character: 5,
                        line: 3
                    },
                    start: {
                        character: 4,
                        line: 3
                    }
                },
                severity: 4,
                source: 'ts',
                tags: [2]
            },
            {
                code: 6133,
                message: "'c' is declared but its value is never read.",
                range: {
                    end: {
                        character: 9,
                        line: 4
                    },
                    start: {
                        character: 8,
                        line: 4
                    }
                },
                severity: 4,
                source: 'ts',
                tags: [1]
            }
        ]);
    });

    it('ignores coffeescript', async () => {
        const { plugin, document } = setup('diagnostics-coffeescript.svelte');
        const diagnostics = await plugin.getDiagnostics(document);

        assert.deepStrictEqual(diagnostics, []);
    });
});
