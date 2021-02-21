import * as assert from 'assert';
import * as path from 'path';
import ts from 'typescript';
import { Hover, Position } from 'vscode-languageserver';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { LSConfigManager } from '../../../../src/ls-config';
import { HoverProviderImpl } from '../../../../src/plugins/typescript/features/HoverProvider';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { pathToUrl } from '../../../../src/utils';

const testDir = path.join(__dirname, '..');

describe('HoverProvider', () => {
    function getFullPath(filename: string) {
        return path.join(testDir, 'testfiles', 'hover', filename);
    }

    function setup(filename: string) {
        const docManager = new DocumentManager(
            (textDocument) => new Document(textDocument.uri, textDocument.text)
        );
        const lsAndTsDocResolver = new LSAndTSDocResolver(
            docManager,
            [testDir],
            new LSConfigManager()
        );
        const provider = new HoverProviderImpl(lsAndTsDocResolver);
        const document = openDoc(filename);
        return { provider, document };

        function openDoc(filename: string) {
            const filePath = getFullPath(filename);
            const doc = docManager.openDocument(<any>{
                uri: pathToUrl(filePath),
                text: ts.sys.readFile(filePath) || ''
            });
            return doc;
        }
    }

    it('provides basic hover info when no docstring exists', async () => {
        const { provider, document } = setup('hoverinfo.svelte');

        assert.deepStrictEqual(await provider.doHover(document, Position.create(6, 10)), <Hover>{
            contents: '```typescript\nconst withoutDocs: true\n```',
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
            contents: '```typescript\nconst withDocs: true\n```\n---\nDocumentation string',
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

    it('provides formatted hover info for component events', async () => {
        const { provider, document } = setup('hoverinfo.svelte');

        assert.deepStrictEqual(await provider.doHover(document, Position.create(12, 26)), <Hover>{
            contents:
                '```typescript\nabc: MouseEvent\n```\n\nTEST\n```ts\nconst abc: boolean = true;\n```\n'
        });
    });

    it('provides formatted hover info for jsDoc tags', async () => {
        const { provider, document } = setup('hoverinfo.svelte');

        assert.deepStrictEqual(await provider.doHover(document, Position.create(9, 10)), <Hover>{
            contents: '```typescript\nconst withJsDocTag: true\n```\n---\n\n\n*@author* — foo',
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
});
