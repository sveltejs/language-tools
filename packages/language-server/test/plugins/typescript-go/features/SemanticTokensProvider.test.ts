import path from 'path';
import ts from 'typescript';
import {
    CancellationToken,
    Range,
    SemanticTokens,
    SemanticTokensRangeRequest,
    SemanticTokensRequest,
    ServerCapabilities
} from 'vscode-languageserver';
import { Document } from '../../../../src/lib/documents';
import { getSemanticTokenLegends } from '../../../../src/lib/semanticToken/semanticTokenLegend';
import { SemanticTokensProvider } from '../../../../src/plugins';
import { pathToUrl } from '../../../../src/utils';
import { setupSharedServices } from '../../typescript-go/test-utils';
import { semanticTokensTest } from '../../typescript/features/SemanticTokensProvider.test';

const testDir = path.join(__dirname, '../../typescript');
const semanticTokenTestDir = path.join(testDir, 'testfiles', 'semantic-tokens');

// Differences with the original test
// The TokenType and TokenModifier indices differ between our ts plugin and the new ts lsp.

describe('SemanticTokensProvider (TS GO)', function () {
    const tokenLegends = getSemanticTokenLegends();
    const getServices = setupSharedServices(semanticTokenTestDir, {
        capabilities: {
            textDocument: {
                semanticTokens: {
                    formats: ['relative'],
                    requests: {
                        full: {
                            delta: false
                        },
                        range: true
                    },
                    tokenModifiers: tokenLegends.tokenModifiers,
                    tokenTypes: tokenLegends.tokenTypes
                }
            }
        }
    });
    semanticTokensTest(setup);

    function setup(fileName: string) {
        const { docManager, service } = getServices();
        const filePath = path.join(testDir, 'testfiles', 'semantic-tokens', fileName);
        const provider: SemanticTokensProvider = {
            async getSemanticTokens(
                document: Document,
                range?: Range,
                cancellationToken?: CancellationToken
            ) {
                let res: SemanticTokens | null;
                if (range === undefined) {
                    res = await service.sendRequest(SemanticTokensRequest.type, {
                        textDocument: {
                            uri: document.uri
                        }
                    });
                } else {
                    res = await service.sendRequest(SemanticTokensRangeRequest.type, {
                        textDocument: {
                            uri: document.uri
                        },
                        range
                    });
                }
                if (cancellationToken?.isCancellationRequested) {
                    return null;
                }
                return convertTypes(service.getServerCapability(), res);
            }
        };
        const document = docManager.openClientDocument(<any>{
            uri: pathToUrl(filePath),
            text: ts.sys.readFile(filePath)
        });
        return { provider, document };
    }

    function convertTypes(serverCapabilities: ServerCapabilities, result: SemanticTokens | null) {
        if (!result) {
            return null;
        }

        let index = 0;
        const tokenTypes = serverCapabilities?.semanticTokensProvider?.legend.tokenTypes;
        if (!tokenTypes) {
            throw new Error('Server does not provide semantic token types.');
        }
        const tokenModifiers = serverCapabilities?.semanticTokensProvider?.legend.tokenModifiers;
        if (!tokenModifiers) {
            throw new Error('Server does not provide semantic token modifiers.');
        }

        const oldFormat = getSemanticTokenLegends();
        const convertTokenType = (v: number) => {
            const name = tokenTypes[v];
            return oldFormat.tokenTypes.indexOf(name);
        };
        const convertTokenModifier = (v: number) => {
            let result = 0;
            for (let i = 0; i < tokenModifiers.length; i++) {
                const name = tokenModifiers[i];
                const flag = 1 << i;
                if (v & flag) {
                    const oldFormatFlag = 1 << oldFormat.tokenModifiers.indexOf(name);
                    result |= oldFormatFlag;
                }
            }
            return result;
        };
        const converted: SemanticTokens = {
            ...result.data,
            data: []
        };
        while (index < result.data.length) {
            converted.data.push(
                result.data[index],
                result.data[index + 1],
                result.data[index + 2],
                convertTokenType(result.data[index + 3]),
                convertTokenModifier(result.data[index + 4])
            );
            index += 5;
        }
        return converted;
    }
});
