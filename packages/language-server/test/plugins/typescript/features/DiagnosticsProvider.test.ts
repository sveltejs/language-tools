import * as assert from 'assert';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import * as path from 'path';
import ts from 'typescript';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { LSConfigManager } from '../../../../src/ls-config';
import { DiagnosticsProviderImpl } from '../../../../src/plugins/typescript/features/DiagnosticsProvider';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { pathToUrl, urlToPath } from '../../../../src/utils';

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
        return { plugin, document, docManager, lsAndTsDocResolver };
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
                        line: 6
                    },
                    start: {
                        character: 1,
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
                        character: 9,
                        line: 7
                    },
                    start: {
                        character: 4,
                        line: 7
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
                        character: 14,
                        line: 8
                    },
                    start: {
                        character: 1,
                        line: 8
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
                        line: 11
                    },
                    start: {
                        character: 2,
                        line: 11
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
                        line: 12
                    },
                    start: {
                        character: 6,
                        line: 12
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
                        character: 15,
                        line: 15
                    },
                    start: {
                        character: 2,
                        line: 15
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
                message: "'a' is deprecated.",
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

    it('$store control flow', async () => {
        const { plugin, document } = setup('diagnostics-$store-control-flow.svelte');
        const diagnostics = await plugin.getDiagnostics(document);

        assert.deepStrictEqual(diagnostics, [
            {
                code: 2367,
                message:
                    "This condition will always return 'false' since the types 'string' and 'boolean' have no overlap.",
                range: {
                    end: {
                        character: 57,
                        line: 15
                    },
                    start: {
                        character: 40,
                        line: 15
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2322,
                message: "Type 'string' is not assignable to type 'boolean'.",
                range: {
                    end: {
                        character: 16,
                        line: 21
                    },
                    start: {
                        character: 12,
                        line: 21
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2367,
                message:
                    "This condition will always return 'false' since the types 'string' and 'boolean' have no overlap.",
                range: {
                    end: {
                        character: 69,
                        line: 28
                    },
                    start: {
                        character: 46,
                        line: 28
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2367,
                message:
                    "This condition will always return 'false' since the types 'string' and 'boolean' have no overlap.",
                range: {
                    end: {
                        character: 58,
                        line: 35
                    },
                    start: {
                        character: 41,
                        line: 35
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2322,
                message: "Type 'string' is not assignable to type 'boolean'.",
                range: {
                    end: {
                        character: 17,
                        line: 40
                    },
                    start: {
                        character: 13,
                        line: 40
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2367,
                message:
                    "This condition will always return 'false' since the types 'string' and 'boolean' have no overlap.",
                range: {
                    end: {
                        character: 70,
                        line: 47
                    },
                    start: {
                        character: 47,
                        line: 47
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            }
        ]);
    });

    it('if control flow', async () => {
        const { plugin, document } = setup('diagnostics-if-control-flow.svelte');
        const diagnostics = await plugin.getDiagnostics(document);

        assert.deepStrictEqual(diagnostics, [
            {
                code: 2367,
                message:
                    "This condition will always return 'false' since the types 'string' and 'boolean' have no overlap.",
                range: {
                    end: {
                        character: 15,
                        line: 14
                    },
                    start: {
                        character: 5,
                        line: 14
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2367,
                message:
                    "This condition will always return 'false' since the types 'string' and 'boolean' have no overlap.",
                range: {
                    end: {
                        character: 19,
                        line: 17
                    },
                    start: {
                        character: 9,
                        line: 17
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2367,
                message:
                    "This condition will always return 'false' since the types 'string' and 'boolean' have no overlap.",
                range: {
                    end: {
                        character: 19,
                        line: 21
                    },
                    start: {
                        character: 9,
                        line: 21
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2532,
                message: "Object is possibly 'undefined'.",
                range: {
                    end: {
                        character: 14,
                        line: 34
                    },
                    start: {
                        character: 13,
                        line: 34
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2367,
                message:
                    "This condition will always return 'false' since the types 'boolean' and 'string' have no overlap.",
                range: {
                    end: {
                        character: 26,
                        line: 36
                    },
                    start: {
                        character: 17,
                        line: 36
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2367,
                message:
                    "This condition will always return 'false' since the types 'string' and 'boolean' have no overlap.",
                range: {
                    end: {
                        character: 25,
                        line: 45
                    },
                    start: {
                        character: 13,
                        line: 45
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2322,
                message:
                    "Type 'string | boolean' is not assignable to type 'string'.\n  Type 'boolean' is not assignable to type 'string'.",
                range: {
                    end: {
                        character: 8,
                        line: 54
                    },
                    start: {
                        character: 1,
                        line: 54
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2531,
                message: "Object is possibly 'null'.",
                range: {
                    end: {
                        character: 22,
                        line: 56
                    },
                    start: {
                        character: 8,
                        line: 56
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            }
        ]);
    });

    it('if control flow with shadowed variables', async () => {
        const { plugin, document } = setup('diagnostics-if-control-flow-shadowed.svelte');
        const diagnostics = await plugin.getDiagnostics(document);

        assert.deepStrictEqual(diagnostics, [
            {
                code: 2367,
                message:
                    "This condition will always return 'false' since the types 'string' and 'boolean' have no overlap.",
                range: {
                    end: {
                        character: 15,
                        line: 13
                    },
                    start: {
                        character: 5,
                        line: 13
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2322,
                message: "Type 'boolean' is not assignable to type 'string'.",
                range: {
                    end: {
                        character: 16,
                        line: 17
                    },
                    start: {
                        character: 9,
                        line: 17
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2339,
                message: "Property 'a' does not exist on type 'boolean'.",
                range: {
                    end: {
                        character: 16,
                        line: 23
                    },
                    start: {
                        character: 15,
                        line: 23
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2339,
                message:
                    "Property 'a' does not exist on type 'string | boolean'.\n  Property 'a' does not exist on type 'string'.",
                range: {
                    end: {
                        character: 16,
                        line: 29
                    },
                    start: {
                        character: 15,
                        line: 29
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2367,
                message:
                    "This condition will always return 'false' since the types 'string' and 'boolean' have no overlap.",
                range: {
                    end: {
                        character: 24,
                        line: 31
                    },
                    start: {
                        character: 17,
                        line: 31
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            }
        ]);
    });

    it('ignores diagnostics in generated code', async () => {
        const { plugin, document } = setup('diagnostics-ignore-generated.svelte');
        const diagnostics = await plugin.getDiagnostics(document);

        assert.deepStrictEqual(diagnostics, [
            {
                code: 2304,
                message: "Cannot find name 'a'.",
                range: {
                    end: {
                        character: 13,
                        line: 3
                    },
                    start: {
                        character: 12,
                        line: 3
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2304,
                message: "Cannot find name 'a'.",
                range: {
                    end: {
                        character: 6,
                        line: 4
                    },
                    start: {
                        character: 5,
                        line: 4
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2304,
                message: "Cannot find name 'b'.",
                range: {
                    end: {
                        character: 10,
                        line: 8
                    },
                    start: {
                        character: 9,
                        line: 8
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2304,
                message: "Cannot find name 'b'.",
                range: {
                    end: {
                        character: 10,
                        line: 9
                    },
                    start: {
                        character: 9,
                        line: 9
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            }
        ]);
    });

    it('Pug: Ignores errors in template and unused warnings in script', async () => {
        const { plugin, document } = setup('diagnostics-pug.svelte');
        const diagnostics = await plugin.getDiagnostics(document);

        assert.deepStrictEqual(diagnostics, [
            {
                code: 2307,
                message: "Cannot find module '.' or its corresponding type declarations.",
                range: {
                    end: {
                        character: 22,
                        line: 1
                    },
                    start: {
                        character: 19,
                        line: 1
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2307,
                message: "Cannot find module '.' or its corresponding type declarations.",
                range: {
                    end: {
                        character: 30,
                        line: 2
                    },
                    start: {
                        character: 27,
                        line: 2
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2322,
                message: "Type 'boolean' is not assignable to type 'string | number'.",
                range: {
                    end: {
                        character: 10,
                        line: 4
                    },
                    start: {
                        character: 9,
                        line: 4
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            }
        ]);
    });

    it('no errors on intrinsic elements without attributes or events', async () => {
        const { plugin, document } = setup('diagnostics-intrinsic.svelte');
        const diagnostics = await plugin.getDiagnostics(document);
        assert.deepStrictEqual(diagnostics, []);
    });

    it('notices creation and deletion of imported module', async () => {
        const { plugin, document, lsAndTsDocResolver } = setup('unresolvedimport.svelte');

        const diagnostics1 = await plugin.getDiagnostics(document);
        assert.deepStrictEqual(diagnostics1.length, 1);

        // back-and-forth-conversion normalizes slashes
        const newFilePath = urlToPath(pathToUrl(path.join(testDir, 'doesntexistyet.js'))) || '';
        writeFileSync(newFilePath, 'export default function foo() {}');
        assert.ok(existsSync(newFilePath));
        await lsAndTsDocResolver.getSnapshot(newFilePath);

        try {
            const diagnostics2 = await plugin.getDiagnostics(document);
            assert.deepStrictEqual(diagnostics2.length, 0);
            lsAndTsDocResolver.deleteSnapshot(newFilePath);
        } finally {
            unlinkSync(newFilePath);
        }

        const diagnostics3 = await plugin.getDiagnostics(document);
        assert.deepStrictEqual(diagnostics3.length, 1);
    }).timeout(5000);

    function assertPropsDiagnosticsStrict(diagnostics: any[], source: 'ts' | 'js') {
        assert.deepStrictEqual(
            diagnostics.map((d: any) => {
                // irrelevant for this test, save some lines
                delete d.range;
                return d;
            }),
            [
                {
                    code: 2322,
                    message:
                        // eslint-disable-next-line max-len
                        "Type '{}' is not assignable to type 'IntrinsicAttributes & { required: string; optional1?: string | undefined; optional2?: string | undefined; }'.\n  Property 'required' is missing in type '{}' but required in type '{ required: string; optional1?: string | undefined; optional2?: string | undefined; }'.",
                    severity: 1,
                    source,
                    tags: []
                },
                {
                    code: 2322,
                    message: "Type 'undefined' is not assignable to type 'string'.",
                    severity: 1,
                    source,
                    tags: []
                },
                {
                    code: 2322,
                    message:
                        // eslint-disable-next-line max-len
                        "Type '{ required: string; optional1: string; optional2: string; doesntExist: boolean; }' is not assignable to type 'IntrinsicAttributes & { required: string; optional1?: string | undefined; optional2?: string | undefined; }'.\n  Property 'doesntExist' does not exist on type 'IntrinsicAttributes & { required: string; optional1?: string | undefined; optional2?: string | undefined; }'.",
                    severity: 1,
                    source,
                    tags: []
                },
                {
                    code: 2322,
                    message: "Type 'boolean' is not assignable to type 'string'.",
                    severity: 1,
                    source,
                    tags: []
                },
                {
                    code: 2322,
                    message: "Type 'true' is not assignable to type 'string | undefined'.",
                    severity: 1,
                    source,
                    tags: []
                },
                {
                    code: 2322,
                    message: "Type 'true' is not assignable to type 'string | undefined'.",
                    severity: 1,
                    source,
                    tags: []
                },
                {
                    code: 2322,
                    message:
                        // eslint-disable-next-line max-len
                        "Type '{}' is not assignable to type 'IntrinsicAttributes & { required: string; optional1?: string | undefined; optional2?: string | undefined; }'.\n  Property 'required' is missing in type '{}' but required in type '{ required: string; optional1?: string | undefined; optional2?: string | undefined; }'.",
                    severity: 1,
                    source,
                    tags: []
                },
                {
                    code: 2322,
                    message: "Type 'undefined' is not assignable to type 'string'.",
                    severity: 1,
                    source,
                    tags: []
                },
                {
                    code: 2322,
                    message: "Type 'boolean' is not assignable to type 'string'.",
                    severity: 1,
                    source,
                    tags: []
                },
                {
                    code: 2322,
                    message: "Type 'true' is not assignable to type 'string | undefined'.",
                    severity: 1,
                    source,
                    tags: []
                },
                {
                    code: 2322,
                    message: "Type 'true' is not assignable to type 'string | undefined'.",
                    severity: 1,
                    source,
                    tags: []
                }
            ]
        );
    }

    it('checks prop types correctly (ts file, strict mode)', async () => {
        const { plugin, document } = setup(path.join('checkJs', 'props_importer-ts.svelte'));
        const diagnostics = await plugin.getDiagnostics(document);
        assertPropsDiagnosticsStrict(diagnostics, 'ts');
    });

    it('checks prop types correctly (js file, strict mode)', async () => {
        const { plugin, document } = setup(path.join('checkJs', 'props_importer-js.svelte'));
        const diagnostics = await plugin.getDiagnostics(document);
        assertPropsDiagnosticsStrict(diagnostics, 'js');
    });

    function assertPropsDiagnostics(diagnostics: any[], source: 'ts' | 'js') {
        assert.deepStrictEqual(
            diagnostics.map((d: any) => {
                // irrelevant for this test, save some lines
                delete d.range;
                return d;
            }),
            [
                {
                    code: 2322,
                    message:
                        // eslint-disable-next-line max-len
                        "Type '{}' is not assignable to type 'IntrinsicAttributes & { required: string; optional1?: string; optional2?: string; }'.\n  Property 'required' is missing in type '{}' but required in type '{ required: string; optional1?: string; optional2?: string; }'.",
                    severity: 1,
                    source,
                    tags: []
                },
                {
                    code: 2322,
                    message:
                        // eslint-disable-next-line max-len
                        "Type '{ required: string; optional1: string; optional2: string; doesntExist: boolean; }' is not assignable to type 'IntrinsicAttributes & { required: string; optional1?: string; optional2?: string; }'.\n  Property 'doesntExist' does not exist on type 'IntrinsicAttributes & { required: string; optional1?: string; optional2?: string; }'.",
                    severity: 1,
                    source,
                    tags: []
                },
                {
                    code: 2322,
                    message: "Type 'boolean' is not assignable to type 'string'.",
                    severity: 1,
                    source,
                    tags: []
                },
                {
                    code: 2322,
                    message: "Type 'boolean' is not assignable to type 'string'.",
                    severity: 1,
                    source,
                    tags: []
                },
                {
                    code: 2322,
                    message: "Type 'boolean' is not assignable to type 'string'.",
                    severity: 1,
                    source,
                    tags: []
                },
                {
                    code: 2322,
                    message:
                        // eslint-disable-next-line max-len
                        "Type '{}' is not assignable to type 'IntrinsicAttributes & { required: string; optional1?: string; optional2?: string; }'.\n  Property 'required' is missing in type '{}' but required in type '{ required: string; optional1?: string; optional2?: string; }'.",
                    severity: 1,
                    source,
                    tags: []
                },
                {
                    code: 2322,
                    message: "Type 'boolean' is not assignable to type 'string'.",
                    severity: 1,
                    source,
                    tags: []
                },
                {
                    code: 2322,
                    message: "Type 'boolean' is not assignable to type 'string'.",
                    severity: 1,
                    source,
                    tags: []
                },
                {
                    code: 2322,
                    message: "Type 'boolean' is not assignable to type 'string'.",
                    severity: 1,
                    source,
                    tags: []
                }
            ]
        );
    }

    it('checks prop types correctly (ts file, no strict mode)', async () => {
        const { plugin, document } = setup(
            path.join('checkJs-no-strict', 'props_importer-ts.svelte')
        );
        const diagnostics = await plugin.getDiagnostics(document);
        assertPropsDiagnostics(diagnostics, 'ts');
    });

    it('checks prop types correctly (js file, no strict mode)', async () => {
        const { plugin, document } = setup(
            path.join('checkJs-no-strict', 'props_importer-js.svelte')
        );
        const diagnostics = await plugin.getDiagnostics(document);
        assertPropsDiagnostics(diagnostics, 'js');
    });
});
