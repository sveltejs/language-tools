import path from 'path';
import ts from 'typescript';
import { HoverRequest } from 'vscode-languageserver';
import { Hover, MarkupKind, Position } from 'vscode-languageserver-types';
import { Document } from '../../../../src/lib/documents';
import { HoverProvider } from '../../../../src/plugins';
import { pathToUrl } from '../../../../src/utils';
import { TemplateASTParseLoader } from '../../../../src/plugins/svelte/TemplateASTLoader';
import { TsgoResponseTransformer } from '../../../../src/plugins/typescript-go/middleware';
import { TsApiService } from '../../../../src/plugins/typescript-go/TsApiService';
import { FileSystemProvider } from '../../../../src/lib/FileSystemProvider';
import { HTMLPlugin } from '../../../../src/plugins/html/HTMLPlugin';
import { PluginHost } from '../../../../src/plugins/PluginHost';
import { SveltePlugin } from '../../../../src/plugins/svelte/SveltePlugin';
import { TypeScriptGoPlugin } from '../../../../src/plugins/typescript-go/TypeScriptGoPlugin';
import { createTsApiServiceForTest, setupSharedServices } from '../test-utils';
import assert from 'assert';

const testDir = path.join(__dirname, '../../typescript');
const hoverTestDir = path.join(testDir, 'testfiles', 'hover');

// Differences with the original test
// 1. Result contents format. Our ts plugin returns markdown string and not clearly marked as markdown like the new ts lsp
// 2. The information has slightly different markdown formatting compared to the new ts lsp.

describe('HoverProvider (TS GO)', function () {
    const getServices = setupSharedServices(hoverTestDir, {
        capabilities: {
            textDocument: {
                hover: {
                    contentFormat: [MarkupKind.Markdown, MarkupKind.PlainText]
                }
            }
        }
    });

    // Content mapper mode: TS7's hover goes through the middleware; the hovers TS7 doesn't give are
    // the Svelte language server's own (plugins in the server's order, the first answer counts)
    let api: TsApiService | undefined;
    let transformer: TsgoResponseTransformer | undefined;
    let pluginHost: PluginHost | undefined;
    before(async () => {
        const { service, docManager, lsConfigManager } = getServices();
        api = await createTsApiServiceForTest(service, lsConfigManager);
        transformer = new TsgoResponseTransformer(
            docManager,
            new TemplateASTParseLoader(docManager),
            { findDocumentHighlight: async () => null },
            api
        );
        pluginHost = new PluginHost(docManager);
        pluginHost.initialize({ filterIncompleteCompletions: true, definitionLinkSupport: true });
        pluginHost.register(
            new SveltePlugin(lsConfigManager, new TemplateASTParseLoader(docManager))
        );
        pluginHost.register(
            new HTMLPlugin(docManager, lsConfigManager, new FileSystemProvider(), [])
        );
        pluginHost.register(new TypeScriptGoPlugin(api!, lsConfigManager));
    });

    /** TS7's own hover (none) and the Svelte language server's */
    async function bothServers(document: Document, position: Position) {
        const ts7 = await getServices().service.sendRequest(HoverRequest.type, {
            textDocument: { uri: document.getURL() },
            position
        });
        const svelte = await pluginHost!.doHover({ uri: document.getURL() }, position);
        return { ts7, svelte };
    }
    after(async () => {
        await api?.dispose().catch(() => {});
    });

    function getFullPath(filename: string) {
        return path.join(hoverTestDir, filename);
    }

    function setup(filename: string) {
        const { docManager, service } = getServices();
        const provider: HoverProvider = {
            async doHover(document: Document, position: Position) {
                const params = {
                    textDocument: {
                        uri: document.getURL()
                    },
                    position
                };
                const res = await service.sendRequest(HoverRequest.type, params);

                return (await transformer!.transform({
                    method: 'textDocument/hover',
                    params,
                    result: res
                })) as Hover | null;
            }
        };

        const document = openDoc(filename);

        return {
            provider,
            document
        };

        function openDoc(filename: string) {
            const filePath = getFullPath(filename);
            const doc = docManager.openClientDocument(<any>{
                uri: pathToUrl(filePath),
                text: ts.sys.readFile(filePath) || ''
            });
            return doc;
        }
    }

    it('provides basic hover info when no docstring exists', async () => {
        const { provider, document } = setup('hoverinfo.svelte');

        assert.deepStrictEqual(await provider.doHover(document, Position.create(6, 10)), <Hover>{
            contents: {
                kind: 'markdown',
                value: '```typescript\nconst withoutDocs: true\n```\n'
            },
            range: {
                start: {
                    character: 10,
                    line: 6
                },
                end: {
                    character: 21,
                    line: 6
                }
            }
        });
    });

    it('provides formatted hover info when a docstring exists', async () => {
        const { provider, document } = setup('hoverinfo.svelte');

        assert.deepStrictEqual(await provider.doHover(document, Position.create(4, 10)), <Hover>{
            contents: {
                kind: 'markdown',
                value: '```typescript\nconst withDocs: true\n```\nDocumentation string'
            },
            range: {
                start: {
                    character: 10,
                    line: 4
                },
                end: {
                    character: 18,
                    line: 4
                }
            }
        });
    });

    // TS7 returns nothing here; the Svelte LS answers from the TS7 API (features/HoverProvider.ts)
    it('provides formatted hover info for component events', async () => {
        const { document } = setup('hoverinfo.svelte');

        const { ts7, svelte } = await bothServers(document, Position.create(12, 26));
        assert.strictEqual(ts7, null);
        assert.deepStrictEqual(svelte, <Hover>{
            contents: {
                kind: 'markdown',
                value: '```typescript\nabc: MouseEvent\n```\nTEST\n```ts\nconst abc: boolean = true;\n```'
            }
        });
    });

    it('provides formatted hover info for jsDoc tags', async () => {
        const { provider, document } = setup('hoverinfo.svelte');

        assert.deepStrictEqual(await provider.doHover(document, Position.create(9, 10)), <Hover>{
            contents: {
                kind: 'markdown',
                value: '```typescript\nconst withJsDocTag: true\n```\n\n\n*@author* — foo'
            },
            range: {
                start: {
                    character: 10,
                    line: 9
                },
                end: {
                    character: 22,
                    line: 9
                }
            }
        });
    });

    it('provides hover info for $store access', async () => {
        const { provider, document } = setup('hover-$store.svelte');

        assert.deepStrictEqual(await provider.doHover(document, Position.create(3, 5)), <Hover>{
            contents: {
                kind: 'markdown',
                value: '```typescript\nlet $b: string | {\n    a: boolean | string;\n}\n```\n'
            },
            range: {
                end: {
                    character: 6,
                    line: 3
                },
                start: {
                    character: 4,
                    line: 3
                }
            }
        });
        assert.deepStrictEqual(await provider.doHover(document, Position.create(5, 9)), <Hover>{
            contents: {
                kind: 'markdown',
                value: '```typescript\nlet $b: string\n```\n'
            },
            range: {
                end: {
                    character: 10,
                    line: 5
                },
                start: {
                    character: 8,
                    line: 5
                }
            }
        });
        assert.deepStrictEqual(await provider.doHover(document, Position.create(7, 4)), <Hover>{
            contents: {
                kind: 'markdown',
                value: '```typescript\nconst b: Writable<string | {\n    a: boolean | string;\n}>\n```\n'
            },
            range: {
                end: {
                    character: 5,
                    line: 7
                },
                start: {
                    character: 4,
                    line: 7
                }
            }
        });

        assert.deepStrictEqual(await provider.doHover(document, Position.create(10, 2)), <Hover>{
            contents: {
                kind: 'markdown',
                value: '```typescript\nlet $b: string | {\n    a: boolean | string;\n}\n```\n'
            },
            range: {
                end: {
                    character: 3,
                    line: 10
                },
                start: {
                    character: 1,
                    line: 10
                }
            }
        });
        assert.deepStrictEqual(await provider.doHover(document, Position.create(12, 6)), <Hover>{
            contents: {
                kind: 'markdown',
                value: '```typescript\nlet $b: string\n```\n'
            },
            range: {
                end: {
                    character: 7,
                    line: 12
                },
                start: {
                    character: 5,
                    line: 12
                }
            }
        });
        assert.deepStrictEqual(await provider.doHover(document, Position.create(14, 1)), <Hover>{
            contents: {
                kind: 'markdown',
                value: '```typescript\nconst b: Writable<string | {\n    a: boolean | string;\n}>\n```\n'
            },
            range: {
                end: {
                    character: 2,
                    line: 14
                },
                start: {
                    character: 1,
                    line: 14
                }
            }
        });
    });

    // TS7 returns nothing here; the Svelte LS answers from the TS7 API (features/HoverProvider.ts)
    it('provides formatted hover info for custom elements', async () => {
        const { document } = setup('hoverinfo.svelte');

        const { ts7, svelte } = await bothServers(document, Position.create(13, 7));
        assert.strictEqual(ts7, null);
        assert.deepStrictEqual(svelte, <Hover>{
            contents: {
                value: 'Custom doc for custom element',
                kind: 'markdown'
            }
        });
    });

    // TS7 serves this one itself (in its format: markdown, no `---`)
    it('provides formatted hover info for custom elements properties', async () => {
        const { provider, document } = setup('hoverinfo.svelte');

        assert.deepStrictEqual(await provider.doHover(document, Position.create(13, 18)), <Hover>{
            contents: {
                kind: 'markdown',
                value: '```typescript\n(property) foo: string\n```\nbar'
            },
            range: {
                end: {
                    character: 19,
                    line: 13
                },
                start: {
                    character: 16,
                    line: 13
                }
            }
        });
    });
});
