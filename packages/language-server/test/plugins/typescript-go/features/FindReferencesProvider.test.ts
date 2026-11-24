import path from 'path';
import { createTsApiServiceForTest, setupSharedServices, setupSkip } from '../test-utils';
import { FindReferencesProvider } from '../../../../src/plugins';
import { Location, Position, ReferenceContext } from 'vscode-languageserver-types';
import { CancellationToken, ReferencesRequest } from 'vscode-languageserver';
import { Document } from '../../../../src/lib/documents';
import { pathToUrl } from '../../../../src/utils';
import ts from 'typescript';
import { findReferencesTest } from '../../typescript/features/FindReferencesProvider.test';
import { TemplateASTParseLoader } from '../../../../src/plugins/svelte/TemplateASTLoader';
import { TsgoResponseTransformer } from '../../../../src/plugins/typescript-go/middleware';
import { TsApiService } from '../../../../src/plugins/typescript-go/TsApiService';
import { TypeScriptGoPlugin } from '../../../../src/plugins/typescript-go/TypeScriptGoPlugin';

const testDir = path.join(__dirname, '../../typescript');
const testFilesDir = path.join(testDir, 'testfiles');

describe('FindReferencesProvider (TS GO)', function () {
    const getServices = setupSharedServices(testFilesDir);

    // What VS Code gets in content mapper mode: TS7's references after our middleware, merged
    // with the Svelte language server's (component references from the script tag)
    let api: TsApiService;
    let transformer: TsgoResponseTransformer;
    let plugin: TypeScriptGoPlugin;
    before(async () => {
        const { service, docManager, lsConfigManager } = getServices();
        api = await createTsApiServiceForTest(service, lsConfigManager);
        transformer = new TsgoResponseTransformer(
            docManager,
            new TemplateASTParseLoader(docManager),
            { findDocumentHighlight: async () => null },
            api
        );
        plugin = new TypeScriptGoPlugin(api, lsConfigManager);
    });
    after(async () => {
        await api?.dispose().catch(() => {});
    });

    // From the component tag, TS7 finds the references of the import (incl. end tags) instead
    const skips = ['can find all component references'];
    findReferencesTest(setup, setupSkip(it, skips));

    function getFullPath(filename: string) {
        return path.join(testDir, 'testfiles', filename);
    }

    function setup(filename: string) {
        const { docManager, service } = getServices();
        const provider: FindReferencesProvider = {
            async findReferences(
                document: Document,
                position: Position,
                context: ReferenceContext,
                cancellationToken?: CancellationToken
            ) {
                const params = {
                    textDocument: {
                        uri: document.getURL()
                    },
                    position,
                    context
                };
                const raw = await service.sendRequest(
                    ReferencesRequest.type,
                    params,
                    cancellationToken
                );
                const tsgo = (await transformer.transform({
                    method: ReferencesRequest.method,
                    params,
                    result: raw
                })) as Location[] | null;
                const svelte = await plugin.findReferences(document, position);
                const res = svelte ? [...svelte, ...(tsgo ?? [])] : tsgo;

                if (
                    document.getURL().includes('declaration-map') ||
                    document.getURL().includes('find-references-%24store')
                ) {
                    // The only differences with the old result is the order of the references.
                    // Sort the result to match the old test expectations.
                    return res?.sort(compareLocations) ?? null;
                }

                return res;
            }
        };
        const document = openDoc(filename);
        return { provider, document, openDoc };

        function openDoc(filename: string) {
            const filePath = getFullPath(filename);
            const doc = docManager.openClientDocument(<any>{
                uri: pathToUrl(filePath),
                text: ts.sys.readFile(filePath) || ''
            });
            return doc;
        }
    }
});

function compareLocations(a: Location, b: Location) {
    return (
        (a.uri < b.uri ? -1 : a.uri > b.uri ? 1 : 0) ||
        a.range.start.line - b.range.start.line ||
        a.range.start.character - b.range.start.character
    );
}
