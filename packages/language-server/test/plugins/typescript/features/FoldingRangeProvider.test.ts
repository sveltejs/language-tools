import * as assert from 'assert';
import * as path from 'path';
import ts from 'typescript';
import { FoldingRange, FoldingRangeKind } from 'vscode-languageserver';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { LSConfigManager } from '../../../../src/ls-config';
import { FoldingRangeProviderImpl } from '../../../../src/plugins/typescript/features/FoldingRangeProvider';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { __resetCache } from '../../../../src/plugins/typescript/service';
import { pathToUrl } from '../../../../src/utils';
import { serviceWarmup } from '../test-utils';

const testDir = path.join(__dirname, '..');
const foldingTestDir = path.join(testDir, 'testfiles', 'folding-range');

describe('FoldingRangeProvider', function () {
    serviceWarmup(this, foldingTestDir, pathToUrl(testDir));

    function setup(filename: string) {
        const docManager = new DocumentManager(
            (textDocument) => new Document(textDocument.uri, textDocument.text)
        );
        const lsConfigManager = new LSConfigManager();

        lsConfigManager.updateClientCapabilities({
            textDocument: { foldingRange: { lineFoldingOnly: true } }
        });
        const lsAndTsDocResolver = new LSAndTSDocResolver(docManager, [testDir], lsConfigManager);
        const provider = new FoldingRangeProviderImpl(lsAndTsDocResolver, lsConfigManager);
        const filePath = path.join(foldingTestDir, filename);
        const document = docManager.openDocument(<any>{
            uri: pathToUrl(filePath),
            text: ts.sys.readFile(filePath) || ''
        });
        return { provider, document };
    }

    it('provides folding', async () => {
        const { provider, document } = setup('folding.svelte');

        const foldingRanges = await provider.getFoldingRanges(document);

        assert.deepStrictEqual(foldingRanges, <FoldingRange[]>[
            {
                startLine: 1,
                endLine: 2,
                startCharacter: undefined,
                kind: FoldingRangeKind.Imports,
                endCharacter: undefined
            },
            {
                startLine: 4,
                endLine: 5,
                startCharacter: undefined,
                kind: undefined,
                endCharacter: undefined
            },
            {
                startLine: 9,
                endLine: 10,
                startCharacter: undefined,
                kind: undefined,
                endCharacter: undefined
            },
            {
                startLine: 11,
                endLine: 12,
                startCharacter: undefined,
                kind: undefined,
                endCharacter: undefined
            }
        ]);
    });

    it('provides folding during parser error', async () => {
        const { provider, document } = setup('folding-parser-error.svelte');

        const foldingRanges = await provider.getFoldingRanges(document);

        assert.deepStrictEqual(foldingRanges, <FoldingRange[]>[
            {
                startLine: 1,
                endLine: 2,
                startCharacter: undefined,
                kind: undefined,
                endCharacter: undefined
            },
            {
                startLine: 6,
                endLine: 7,
                startCharacter: undefined,
                kind: undefined,
                endCharacter: undefined
            },
            {
                startLine: 8,
                endLine: 9,
                startCharacter: undefined,
                kind: undefined,
                endCharacter: undefined
            }
        ]);
    });
});
