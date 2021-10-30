import * as assert from 'assert';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import * as path from 'path';
import ts from 'typescript';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { LSConfigManager } from '../../../../src/ls-config';
import { DiagnosticsProviderImpl } from '../../../../src/plugins/typescript/features/DiagnosticsProvider';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { normalizePath, pathToUrl } from '../../../../src/utils';

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
                    "Type 'HTMLDivElement' is missing the following properties from type 'SVGElement': ownerSVGElement, viewportElement",
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
                    "Type 'HTMLParagraphElement' is missing the following properties from type 'HTMLInputElement': accept, alt, autocomplete, capture, and 51 more.",
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

    it('properly handles complex types for `each` blocks (diagnostics-each)', async () => {
        const { plugin, document } = setup('diagnostics-each.svelte');
        const diagnostics = await plugin.getDiagnostics(document);

        assert.deepStrictEqual(diagnostics, [
            {
                code: 2345,
                message:
                    "Argument of type '{}' is not assignable to parameter of type 'ArrayLike<unknown>'.\n  Property 'length' is missing in type '{}' but required in type 'ArrayLike<unknown>'.",
                range: {
                    end: {
                        character: 24,
                        line: 26
                    },
                    start: {
                        character: 7,
                        line: 26
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2345,
                message:
                    "Argument of type 'number' is not assignable to parameter of type 'ArrayLike<unknown>'.",
                range: {
                    end: {
                        character: 24,
                        line: 30
                    },
                    start: {
                        character: 7,
                        line: 30
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
                        line: 4
                    },
                    start: {
                        character: 12,
                        line: 4
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
                        line: 5
                    },
                    start: {
                        character: 5,
                        line: 5
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
            },
            {
                code: 2304,
                message: "Cannot find name 'b'.",
                range: {
                    end: {
                        character: 10,
                        line: 10
                    },
                    start: {
                        character: 9,
                        line: 10
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2322,
                message: 'Type \'"food"\' is not assignable to type \'"foo" | "bar"\'.',
                range: {
                    start: {
                        character: 2,
                        line: 15
                    },
                    end: {
                        character: 9,
                        line: 15
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
        const newFilePath = normalizePath(path.join(testDir, 'doesntexistyet.js')) || '';
        writeFileSync(newFilePath, 'export default function foo() {}');
        assert.ok(existsSync(newFilePath));
        await lsAndTsDocResolver.getSnapshot(newFilePath);

        try {
            const diagnostics2 = await plugin.getDiagnostics(document);
            assert.deepStrictEqual(diagnostics2.length, 0);
            await lsAndTsDocResolver.deleteSnapshot(newFilePath);
        } finally {
            unlinkSync(newFilePath);
        }

        const diagnostics3 = await plugin.getDiagnostics(document);
        assert.deepStrictEqual(diagnostics3.length, 1);
    }).timeout(5000);

    it('notices file changes in all services that reference that file', async () => {
        const { plugin, document, docManager, lsAndTsDocResolver } = setup(
            'different-ts-service.svelte'
        );
        const otherFilePath = path.join(
            testDir,
            'different-ts-service',
            'different-ts-service.svelte'
        );
        const otherDocument = docManager.openDocument(<any>{
            uri: pathToUrl(otherFilePath),
            text: ts.sys.readFile(otherFilePath) || ''
        });
        // needed because tests have nasty dependencies between them. The ts service
        // is cached and knows the docs already
        const sharedFilePath = path.join(testDir, 'shared-comp.svelte');
        docManager.openDocument(<any>{
            uri: pathToUrl(sharedFilePath),
            text: ts.sys.readFile(sharedFilePath) || ''
        });

        const diagnostics1 = await plugin.getDiagnostics(document);
        assert.deepStrictEqual(diagnostics1.length, 2);
        const diagnostics2 = await plugin.getDiagnostics(otherDocument);
        assert.deepStrictEqual(diagnostics2.length, 2);

        docManager.updateDocument(
            { uri: pathToUrl(path.join(testDir, 'shared-comp.svelte')), version: 2 },
            [
                {
                    range: { start: { line: 1, character: 19 }, end: { line: 1, character: 19 } },
                    text: 'o'
                }
            ]
        );
        await lsAndTsDocResolver.updateExistingTsOrJsFile(path.join(testDir, 'shared-ts-file.ts'), [
            {
                range: { start: { line: 0, character: 18 }, end: { line: 0, character: 18 } },
                text: 'r'
            }
        ]);
        // Wait until the LsAndTsDocResolver notifies the services of the document update
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const diagnostics3 = await plugin.getDiagnostics(document);
        assert.deepStrictEqual(diagnostics3.length, 0);
        const diagnostics4 = await plugin.getDiagnostics(otherDocument);
        assert.deepStrictEqual(diagnostics4.length, 0);
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

    it('checks generics correctly', async () => {
        const { plugin, document } = setup('diagnostics-generics.svelte');
        const diagnostics = await plugin.getDiagnostics(document);
        assert.deepStrictEqual(diagnostics, [
            {
                code: 2322,
                message:
                    'Type \'"asd"\' is not assignable to type \'number | unique symbol | "anchor" | "toString" | "charAt" | "charCodeAt" | "concat" | "indexOf" | "lastIndexOf" | "localeCompare" | "match" | "replace" | "search" | "slice" | ... 35 more ... | "replaceAll"\'.',
                range: {
                    start: {
                        character: 25,
                        line: 10
                    },
                    end: {
                        character: 26,
                        line: 10
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
                    start: {
                        character: 35,
                        line: 10
                    },
                    end: {
                        character: 36,
                        line: 10
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
                    start: {
                        character: 3,
                        line: 11
                    },
                    end: {
                        character: 13,
                        line: 11
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
                        character: 72,
                        line: 10
                    },
                    start: {
                        character: 55,
                        line: 10
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2367,
                message:
                    "This condition will always return 'false' since the types '\"anchor\"' and '\"big\"' have no overlap.",
                range: {
                    end: {
                        character: 16,
                        line: 15
                    },
                    start: {
                        character: 5,
                        line: 15
                    }
                },
                tags: [],
                severity: 1,
                source: 'ts'
            }
        ]);
    });

    it('filters out unused $$Generic hint', async () => {
        const { plugin, document } = setup('$$generic-unused.svelte');
        const diagnostics = await plugin.getDiagnostics(document);
        assert.deepStrictEqual(diagnostics, []);
    });

    it('checks $$Events usage', async () => {
        const { plugin, document } = setup('$$events.svelte');
        const diagnostics = await plugin.getDiagnostics(document);
        assert.deepStrictEqual(diagnostics, [
            {
                code: 2345,
                message:
                    "Argument of type 'true' is not assignable to parameter of type 'string | undefined'.",
                range: {
                    start: {
                        character: 20,
                        line: 12
                    },
                    end: {
                        character: 24,
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
                    'Argument of type \'"click"\' is not assignable to parameter of type \'"foo"\'.',
                range: {
                    start: {
                        character: 13,
                        line: 13
                    },
                    end: {
                        character: 20,
                        line: 13
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            }
        ]);
    });

    it('checks $$Events component usage', async () => {
        const { plugin, document } = setup('diagnostics-$$events.svelte');
        const diagnostics = await plugin.getDiagnostics(document);
        assert.deepStrictEqual(diagnostics, [
            {
                code: 2345,
                message:
                    // Note: If you only run this test, the test message is slightly different for some reason
                    'Argument of type \'"bar"\' is not assignable to parameter of type \'"foo" | "click"\'.',
                range: {
                    start: {
                        character: 10,
                        line: 7
                    },
                    end: {
                        character: 15,
                        line: 7
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
                    start: {
                        character: 37,
                        line: 7
                    },
                    end: {
                        character: 54,
                        line: 7
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            }
        ]);
    });

    it('checks strictEvents', async () => {
        const { plugin, document } = setup('diagnostics-strictEvents.svelte');
        const diagnostics = await plugin.getDiagnostics(document);
        assert.deepStrictEqual(diagnostics, [
            {
                code: 2345,
                message:
                    // Note: If you only run this test, the test message is slightly different for some reason
                    'Argument of type \'"bar"\' is not assignable to parameter of type \'"foo" | "click"\'.',
                range: {
                    start: {
                        character: 16,
                        line: 7
                    },
                    end: {
                        character: 21,
                        line: 7
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            }
        ]);
    });

    it('checks $$Slots usage', async () => {
        const { plugin, document } = setup('$$slots.svelte');
        const diagnostics = await plugin.getDiagnostics(document);
        assert.deepStrictEqual(diagnostics, [
            {
                code: 2345,
                message:
                    "Argument of type 'boolean' is not assignable to parameter of type 'string'.",
                range: {
                    start: {
                        character: 41,
                        line: 13
                    },
                    end: {
                        character: 45,
                        line: 13
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2345,
                message:
                    'Argument of type \'"invalidProp1"\' is not assignable to parameter of type \'"valid1" | "validPropWrongType1"\'.',
                range: {
                    start: {
                        character: 60,
                        line: 13
                    },
                    end: {
                        character: 60,
                        line: 13
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2345,
                message:
                    "Argument of type 'boolean' is not assignable to parameter of type 'string'.",
                range: {
                    start: {
                        character: 52,
                        line: 14
                    },
                    end: {
                        character: 56,
                        line: 14
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2345,
                message:
                    'Argument of type \'"invalidProp2"\' is not assignable to parameter of type \'"valid2" | "validPropWrongType2"\'.',
                range: {
                    start: {
                        character: 71,
                        line: 14
                    },
                    end: {
                        character: 71,
                        line: 14
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2345,
                message:
                    "Argument of type '\"invalid\"' is not assignable to parameter of type 'keyof $$Slots'.",
                range: {
                    start: {
                        character: 26,
                        line: 15
                    },
                    end: {
                        character: 26,
                        line: 15
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            }
        ]);
    });

    it('checks $$Slots component usage', async () => {
        const { plugin, document } = setup('using-$$slots.svelte');
        const diagnostics = await plugin.getDiagnostics(document);
        assert.deepStrictEqual(diagnostics, [
            {
                code: 2339,
                message:
                    "Property 'invalidProp1' does not exist on type '{ valid1: boolean; validPropWrongType1: string; }'.",
                range: {
                    start: {
                        character: 46,
                        line: 4
                    },
                    end: {
                        character: 58,
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
                    "This condition will always return 'false' since the types 'string' and 'boolean' have no overlap.",
                range: {
                    start: {
                        character: 5,
                        line: 6
                    },
                    end: {
                        character: 33,
                        line: 6
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2339,
                message:
                    "Property 'invalidProp2' does not exist on type '{ valid2: boolean; validPropWrongType2: string; }'.",
                range: {
                    start: {
                        character: 59,
                        line: 8
                    },
                    end: {
                        character: 71,
                        line: 8
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
                    start: {
                        character: 9,
                        line: 10
                    },
                    end: {
                        character: 37,
                        line: 10
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            }
        ]);
    });

    it('checks $$Props usage (valid)', async () => {
        const { plugin, document } = setup('$$props-valid.svelte');
        const diagnostics = await plugin.getDiagnostics(document);
        assert.deepStrictEqual(diagnostics, []);
    });

    it('checks $$Props usage (invalid1)', async () => {
        const { plugin, document } = setup('$$props-invalid1.svelte');
        const diagnostics = await plugin.getDiagnostics(document);
        assert.deepStrictEqual(diagnostics, [
            {
                code: 2345,
                message:
                    // eslint-disable-next-line max-len
                    "Argument of type '$$Props' is not assignable to parameter of type '{ exported1: string; }'.\n  Types of property 'exported1' are incompatible.\n    Type 'string | undefined' is not assignable to type 'string'.\n      Type 'undefined' is not assignable to type 'string'.",
                range: {
                    end: {
                        character: 18,
                        line: 1
                    },
                    start: {
                        character: 11,
                        line: 1
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            }
        ]);
    });

    it('checks $$Props usage (invalid2)', async () => {
        const { plugin, document } = setup('$$props-invalid2.svelte');
        const diagnostics = await plugin.getDiagnostics(document);
        assert.deepStrictEqual(diagnostics, [
            {
                code: 2345,
                message:
                    // eslint-disable-next-line max-len
                    "Argument of type '$$Props' is not assignable to parameter of type '{ exported1?: string | undefined; }'.\n  Types of property 'exported1' are incompatible.\n    Type 'boolean' is not assignable to type 'string | undefined'.",
                range: {
                    end: {
                        character: 18,
                        line: 1
                    },
                    start: {
                        character: 11,
                        line: 1
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            }
        ]);
    });

    it('checks $$Props usage (invalid3)', async () => {
        const { plugin, document } = setup('$$props-invalid3.svelte');
        const diagnostics = await plugin.getDiagnostics(document);
        assert.deepStrictEqual(diagnostics, [
            {
                code: 2345,
                message:
                    // eslint-disable-next-line max-len
                    "Argument of type '$$Props' is not assignable to parameter of type '{ wrong: boolean; }'.\n  Property 'wrong' is missing in type '$$Props' but required in type '{ wrong: boolean; }'.",
                range: {
                    end: {
                        character: 18,
                        line: 1
                    },
                    start: {
                        character: 11,
                        line: 1
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2345,
                message:
                    // eslint-disable-next-line max-len
                    "Argument of type '{ wrong: boolean; }' is not assignable to parameter of type 'Partial<$$Props>'.\n  Object literal may only specify known properties, and 'wrong' does not exist in type 'Partial<$$Props>'.",
                range: {
                    end: {
                        character: 18,
                        line: 1
                    },
                    start: {
                        character: 11,
                        line: 1
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            }
        ]);
    });

    it('checks $$Props component usage', async () => {
        const { plugin, document } = setup('using-$$props.svelte');
        const diagnostics = await plugin.getDiagnostics(document);
        assert.deepStrictEqual(diagnostics, [
            {
                code: 2322,
                message: "Type 'boolean' is not assignable to type 'string'.",
                range: {
                    end: {
                        character: 16,
                        line: 9
                    },
                    start: {
                        character: 7,
                        line: 9
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2322,
                message:
                    // eslint-disable-next-line max-len
                    "Type '{ exported1: string; exported2: string; invalidProp: boolean; }' is not assignable to type 'IntrinsicAttributes & { exported1: string; exported2?: string | undefined; }'.\n  Property 'invalidProp' does not exist on type 'IntrinsicAttributes & { exported1: string; exported2?: string | undefined; }'.",
                range: {
                    end: {
                        character: 54,
                        line: 10
                    },
                    start: {
                        character: 43,
                        line: 10
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2322,
                message:
                    // eslint-disable-next-line max-len
                    "Type '{}' is not assignable to type 'IntrinsicAttributes & { exported1: string; exported2?: string | undefined; }'.\n  Property 'exported1' is missing in type '{}' but required in type '{ exported1: string; exported2?: string | undefined; }'.",
                range: {
                    end: {
                        character: 6,
                        line: 11
                    },
                    start: {
                        character: 1,
                        line: 11
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            }
        ]);
    });

    it('falls back to any for untyped props and slots in js', async () => {
        const { plugin, document } = setup('using-untyped-js.svelte');
        const diagnostics = await plugin.getDiagnostics(document);
        assert.deepStrictEqual(diagnostics, []);
    });

    it('checks component with accessors when configured in svelte.config.js', async () => {
        const { plugin, document } = setup('with-svelte-config/accessors-consumer.svelte');

        const diagnostics = await plugin.getDiagnostics(document);
        assert.deepStrictEqual(diagnostics, <typeof diagnostics>[
            {
                code: 2322,
                message: "Type '\"\"' is not assignable to type 'number | undefined'.",
                range: {
                    end: {
                        character: 12,
                        line: 9
                    },
                    start: {
                        character: 7,
                        line: 9
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2322,
                message: "Type '\"\"' is not assignable to type 'number | undefined'.",
                range: {
                    end: {
                        character: 20,
                        line: 9
                    },
                    start: {
                        character: 15,
                        line: 9
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            },
            {
                code: 2339,
                message:
                    "Property 'abc' does not exist on type 'AccessorsAndOption__SvelteComponent_'.",
                range: {
                    end: {
                        character: 29,
                        line: 9
                    },
                    start: {
                        character: 26,
                        line: 9
                    }
                },
                severity: 1,
                source: 'ts',
                tags: []
            }
        ]);
    });

    it('diagnoses bind:this', async () => {
        const { plugin, document } = setup('diagnostics-bind-this.svelte');

        const diagnostics = await plugin.getDiagnostics(document);
        assert.deepStrictEqual(diagnostics, [
            {
                range: {
                    start: {
                        line: 14,
                        character: 6
                    },
                    end: {
                        line: 14,
                        character: 13
                    }
                },
                severity: 4,
                source: 'ts',
                message: "'element' is declared but its value is never read.",
                code: 6133,
                tags: [1]
            },
            {
                range: {
                    start: {
                        line: 23,
                        character: 2
                    },
                    end: {
                        line: 23,
                        character: 11
                    }
                },
                severity: 1,
                source: 'ts',
                message: "Variable 'component' is used before being assigned.",
                code: 2454,
                tags: []
            },
            {
                range: {
                    start: {
                        line: 44,
                        character: 16
                    },
                    end: {
                        line: 44,
                        character: 23
                    }
                },
                severity: 1,
                source: 'ts',
                message:
                    "Type 'HTMLDivElement' is missing the following properties from type 'HTMLInputElement': accept, alt, autocomplete, capture, and 51 more.",
                code: 2740,
                tags: []
            },
            {
                range: {
                    start: {
                        line: 45,
                        character: 34
                    },
                    end: {
                        line: 45,
                        character: 48
                    }
                },
                severity: 1,
                source: 'ts',
                message:
                    "Type 'Component' is not assignable to type 'OtherComponent'.\n" +
                    "  Types of property '$set' are incompatible.\n" +
                    "    Type '(props?: Partial<{ prop: boolean; }> | undefined) => void' is not assignable to type '(props?: Partial<{ prop: string; }> | undefined) => void'.\n" +
                    "      Types of parameters 'props' and 'props' are incompatible.\n" +
                    "        Type 'Partial<{ prop: string; }> | undefined' is not assignable to type 'Partial<{ prop: boolean; }> | undefined'.\n" +
                    "          Type 'Partial<{ prop: string; }>' is not assignable to type 'Partial<{ prop: boolean; }>'.\n" +
                    "            Types of property 'prop' are incompatible.\n" +
                    "              Type 'string | undefined' is not assignable to type 'boolean | undefined'.\n" +
                    "                Type 'string' is not assignable to type 'boolean | undefined'.",
                code: 2322,
                tags: []
            },
            {
                range: {
                    start: {
                        line: 46,
                        character: 35
                    },
                    end: {
                        line: 46,
                        character: 57
                    }
                },
                severity: 1,
                source: 'ts',
                message:
                    "Type 'ComponentWithFunction1' is not assignable to type 'ComponentWithFunction2'.\n" +
                    "  Types of property 'action' are incompatible.\n" +
                    "    Type '(a: number) => string | number' is not assignable to type '() => string'.",
                code: 2322,
                tags: []
            },
            {
                range: {
                    start: {
                        line: 47,
                        character: 46
                    },
                    end: {
                        line: 47,
                        character: 60
                    }
                },
                severity: 1,
                source: 'ts',
                message: "Type 'Component' is not assignable to type 'OtherComponent'.",
                code: 2322,
                tags: []
            }
        ]);
    });

    it('diagnoses bindings with $store', async () => {
        const { plugin, document } = setup('bind-to-$store.svelte');

        const diagnostics = await plugin.getDiagnostics(document);
        assert.deepStrictEqual(diagnostics, [
            {
                range: {
                    start: {
                        line: 19,
                        character: 33
                    },
                    end: {
                        line: 19,
                        character: 34
                    }
                },
                severity: 1,
                source: 'ts',
                message: "Type 'number' is not assignable to type 'boolean'.",
                code: 2322,
                tags: []
            },
            {
                range: {
                    start: {
                        line: 20,
                        character: 16
                    },
                    end: {
                        line: 20,
                        character: 20
                    }
                },
                severity: 1,
                source: 'ts',
                message: "Type 'boolean' is not assignable to type 'number'.",
                code: 2322,
                tags: []
            },
            {
                range: {
                    start: {
                        line: 21,
                        character: 24
                    },
                    end: {
                        line: 21,
                        character: 41
                    }
                },
                severity: 1,
                source: 'ts',
                message: "Type 'number' is not assignable to type 'boolean'.",
                code: 2322,
                tags: []
            },
            {
                range: {
                    start: {
                        line: 22,
                        character: 16
                    },
                    end: {
                        line: 22,
                        character: 20
                    }
                },
                severity: 1,
                source: 'ts',
                message: "Type 'boolean' is not assignable to type 'number'.",
                code: 2322,
                tags: []
            }
        ]);
    });
});
