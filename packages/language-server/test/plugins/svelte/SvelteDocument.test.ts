import * as assert from 'assert';
import sinon from 'sinon';
import { Position } from 'vscode-languageserver';
import { Document } from '../../../src/lib/documents';
import * as importPackage from '../../../src/importPackage';
import { SvelteDocument, TranspiledSvelteDocument } from '../../../src/plugins/svelte/SvelteDocument';
import * as configLoader from '../../../src/lib/documents/configLoader';

describe('Svelte Document', () => {
    function getSourceCode(transpiled: boolean): string {
        return `
        <p>jo</p>
        <script>${transpiled ? '\n' : ''}const a = true</script>
        <h1>Hello, world!</h1>
        <style>.bla {}</style>
        `;
    }

    function setup(config: configLoader.SvelteConfig = {}) {
        sinon.stub(configLoader, 'loadConfig').returns(config);
        const parent = new Document('file:///hello.svelte', getSourceCode(false));
        sinon.restore();
        const svelteDoc = new SvelteDocument(parent);
        return { parent, svelteDoc };
    }

    it('gets the parents text', () => {
        const { parent, svelteDoc } = setup();
        assert.strictEqual(svelteDoc.getText(), parent.getText());
    });

    describe('#transpiled', () => {
        async function setupTranspiled() {
            const { parent, svelteDoc } = setup({
                preprocess: {
                    script: () => ({
                        code: '',
                        map: JSON.stringify({
                            version: 3,
                            file: '',
                            names: [],
                            sources: [],
                            sourceRoot: '',
                            mappings: ''
                        })
                    })
                }
            });

            // stub svelte preprocess and getOriginalPosition
            // to fake a source mapping process
            sinon.stub(importPackage, 'importSvelte').returns({
                preprocess: (text, preprocessor) => {
                    preprocessor = Array.isArray(preprocessor) ? preprocessor : [preprocessor];
                    preprocessor.forEach((p) => p.script?.(<any>{}));
                    return Promise.resolve({
                        code: getSourceCode(true),
                        dependencies: [],
                        toString: () => getSourceCode(true)
                    });
                },
                VERSION: <any>'',
                compile: <any>null,
                parse: <any>null
            });
            const transpiled = await svelteDoc.getTranspiled();
            // hacky reset of method because mocking the SourceMap constructor is an impossible task
            (<any>transpiled.scriptMapper).sourceMapper.getOriginalPosition = (pos: any) => {
                pos.line--;
                return pos;
            };
            sinon.restore();

            return { parent, svelteDoc, transpiled };
        }

        function assertCanMapBackAndForth (
            transpiled: TranspiledSvelteDocument,
            generatedPosition: Position,
            originalPosition: Position
        ) {
            assert.deepStrictEqual(
                transpiled.getOriginalPosition(generatedPosition),
                originalPosition,
                'error mapping to original position'
            );

            assert.deepStrictEqual(
                transpiled.getGeneratedPosition(originalPosition),
                generatedPosition,
                'error mapping to generated position'
            );
        }

        it('should map correctly within sourcemapped script', async () => {
            const { transpiled } = await setupTranspiled();

            assertCanMapBackAndForth(transpiled, Position.create(3, 2), Position.create(2, 18));
        });

        it('should map correctly in template before script', async () => {
            const { transpiled } = await setupTranspiled();

            assertCanMapBackAndForth(transpiled, Position.create(1, 1), Position.create(1, 1));
        });

        it('should map correctly in template after script', async () => {
            const { transpiled } = await setupTranspiled();

            assertCanMapBackAndForth(transpiled, Position.create(4, 1), Position.create(3, 1));
        });

        it('should map correctly in style', async () => {
            const { transpiled } = await setupTranspiled();

            assertCanMapBackAndForth(transpiled, Position.create(5, 18), Position.create(4, 18));
        });
    });
});
