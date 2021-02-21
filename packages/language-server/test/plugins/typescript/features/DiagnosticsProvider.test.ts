import * as assert from 'assert';
import * as path from 'path';
import ts from 'typescript';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { LSConfigManager } from '../../../../src/ls-config';
import { DiagnosticsProviderImpl } from '../../../../src/plugins/typescript/features/DiagnosticsProvider';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { pathToUrl } from '../../../../src/utils';

const testDir = path.join(__dirname, '..', 'testfiles', 'diagnostics');

describe('DiagnosticsProvider', () => {
    function setup(filename: string) {
        const docManager = new DocumentManager(
            (textDocument) => new Document(textDocument.uri, textDocument.text)
        );
        const lsAndTsDocResolver = new LSAndTSDocResolver(
            docManager,
            [pathToUrl(testDir)],
            new LSConfigManager()
        );
        const plugin = new DiagnosticsProviderImpl(lsAndTsDocResolver);
        const filePath = path.join(testDir, filename);
        const document = docManager.openDocument(<any>{
            uri: pathToUrl(filePath),
            text: ts.sys.readFile(filePath) || ''
        });
        return { plugin, document, docManager };
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

    it('type-checks actions/transitions/animations', async () => {
        const { plugin, document } = setup('diagnostics-directive-types.svelte');
        const diagnostics = await plugin.getDiagnostics(document);

        assert.deepStrictEqual(diagnostics, [
            {
                code: 2345,
                message:
                    "Argument of type 'HTMLDivElement' is not assignable to parameter of type 'SVGElement & { getTotalLength(): number; }'.\n  " +
                    "Type 'HTMLDivElement' is missing the following properties from type 'SVGElement': ownerSVGElement, viewportElement, correspondingElement, correspondingUseElement",
                range: {
                    end: {
                        character: 19,
                        line: 9
                    },
                    start: {
                        character: 19,
                        line: 9
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2345,
                message:
                    "Argument of type 'HTMLParagraphElement' is not assignable to parameter of type 'HTMLInputElement'.\n  " +
                    "Type 'HTMLParagraphElement' is missing the following properties from type 'HTMLInputElement': accept, alt, autocomplete, checked, and 48 more.",
                range: {
                    end: {
                        character: 12,
                        line: 14
                    },
                    start: {
                        character: 12,
                        line: 14
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            }
        ]);
    });

    it('type-checks slots', async () => {
        const { plugin, document } = setup('diagnostics-slots.svelte');
        const diagnostics = await plugin.getDiagnostics(document);

        assert.deepStrictEqual(diagnostics, [
            {
                code: 2304,
                message: "Cannot find name 'defaultSlotProp'.",
                range: {
                    end: {
                        character: 48,
                        line: 4
                    },
                    start: {
                        character: 33,
                        line: 4
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2367,
                message:
                    "This condition will always return 'false' since the types 'number' and 'boolean' have no overlap.",
                range: {
                    end: {
                        character: 28,
                        line: 6
                    },
                    start: {
                        character: 3,
                        line: 6
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2367,
                message:
                    "This condition will always return 'false' since the types 'boolean' and 'number' have no overlap.",
                range: {
                    end: {
                        character: 24,
                        line: 8
                    },
                    start: {
                        character: 5,
                        line: 8
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2304,
                message: "Cannot find name 'namedSlotProp'.",
                range: {
                    end: {
                        character: 16,
                        line: 12
                    },
                    start: {
                        character: 3,
                        line: 12
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            }
        ]);
    });
});
