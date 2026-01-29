import assert from 'assert';
import { HTMLDocument } from 'vscode-html-languageservice';
import { getAttributeContextAtPosition, parseHtml } from '../../../src/lib/documents/parseHtml';
import { Document } from '../../../src/lib/documents';

describe('parseHtml', () => {
    const testRootElements = (document: HTMLDocument) => {
        assert.deepStrictEqual(
            document.roots.map((r) => r.tag),
            ['Foo', 'style']
        );
    };

    it('ignore arrow inside moustache', () => {
        testRootElements(
            parseHtml(
                `<Foo on:click={() => console.log('ya!!!')} />
                <style></style>`
            )
        );
    });

    it('ignore greater than operator inside moustache', () => {
        testRootElements(
            parseHtml(
                `<Foo checked={a > 1} />
                <style></style>`
            )
        );
    });

    it('ignore less than operator inside moustache', () => {
        testRootElements(
            parseHtml(
                `<Foo checked={a < 1} />
                <style></style>`
            )
        );
    });

    it('ignore binary operator inside @const', () => {
        testRootElements(
            parseHtml(
                `{#if foo}
                  {@const bar = 1 << 2}
                  <Foo  />
                {/if}
                <style></style>`
            )
        );
    });

    it('ignore less than operator inside control flow moustache', () => {
        testRootElements(
            parseHtml(
                `<Foo>
                    {#if 1 < 2 && innWidth <= 700}
                        <Foo>
                            <SelfClosing />
                        </Foo>
                        <div>hi</div>
                    {/if}
                </Foo>
                <style></style>`
            )
        );
    });

    it('ignore less than operator inside moustache with tag not self closed', () => {
        testRootElements(
            parseHtml(
                `<Foo checked={a < 1}>
                </Foo>
                <style></style>`
            )
        );
    });

    it('parse baseline html', () => {
        testRootElements(
            parseHtml(
                `<Foo checked />
                <style></style>`
            )
        );
    });

    it('parse baseline html with moustache', () => {
        testRootElements(
            parseHtml(
                `<Foo checked={a} />
                <style></style>`
            )
        );
    });

    it('parse baseline html with control flow moustache', () => {
        testRootElements(
            parseHtml(
                `<Foo>
                    {#if true}
                        foo
                    {/if}
                </Foo>
                <style></style>`
            )
        );
    });

    it('parse baseline html with possibly un-closed start tag', () => {
        testRootElements(
            parseHtml(
                `<Foo checked={a}
                <style></style>`
            )
        );
    });

    it('can parse html with destructured snippet and type annotation', () => {
        testRootElements(
            parseHtml(
                `{#snippet foo({ props }: { props?: Record<string, unknown> })}{/snippet}
                <Foo checked={a} />
                <style></style>`
            )
        );
    });

    it('can parse html with destructured snippet and type annotation', () => {
        testRootElements(
            parseHtml(
                `{#snippet foo({ props }: { props?: Record<string, unknown> })}{/snippet}
                <Foo checked={a} />
                <style></style>`
            )
        );
    });

    it('can parse html with destructured event handler', () => {
        testRootElements(
            parseHtml(
                `<Foo on:click={({ detail }) => handleClick(detail)} />
                <style></style>`
            )
        );
    });

    it('can parse html with object literal in event handler', () => {
        testRootElements(
            parseHtml(
                `<Foo on:click={(e) => { if ({ x }.x <= 0) {} }} />
                <style></style>`
            )
        );
    });

    it('ignore { inside string', () => {
        testRootElements(
            parseHtml(
                `<Foo title={foo("}") > 1} />
                <style></style>`
            )
        );
    });

    it('ignore } inside template string', () => {
        testRootElements(parseHtml('<Foo title={foo(`${a}}`) < 1} />\n<style></style>'));
    });

    it('ignore } inside template string (nested)', () => {
        testRootElements(parseHtml('<Foo title={foo(`${hi(`${a}}`)}`) < 1} />\n<style></style>'));
    });

    it('parse attribute short-hand', () => {
        const document = parseHtml(
            `<Foo disabled {ariaLabel} />
            <style></style>`
        );
        const fooNode = document.roots.find((r) => r.tag === 'Foo');
        assert.ok(fooNode);
        const ariaLabelValue = fooNode.attributes?.['ariaLabel'];
        assert.strictEqual(ariaLabelValue, '{ariaLabel}');
    });

    it('parse expression', () => {
        const document = parseHtml(
            `<Foo disabled ariaLabel={""} />
            <style></style>`
        );
        const fooNode = document.roots.find((r) => r.tag === 'Foo');
        assert.ok(fooNode);
        const ariaLabelValue = fooNode.attributes?.['ariaLabel'];
        assert.strictEqual(ariaLabelValue, '{""}');
    });

    it('parse expression with spaces around equals', () => {
        const document = parseHtml(`<Foo disabled ariaLabel = {""} />`);
        const fooNode = document.roots.find((r) => r.tag === 'Foo');
        assert.ok(fooNode);
        const ariaLabelValue = fooNode.attributes?.['ariaLabel'];
        assert.strictEqual(ariaLabelValue, '{""}');
    });

    it('parse attributes with interpolation', () => {
        const document = parseHtml(`<Foo ariaLabel="a{b > c ? "": ""} c" />`);
        const fooNode = document.roots.find((r) => r.tag === 'Foo');
        assert.ok(fooNode);
        const ariaLabelValue = fooNode.attributes?.['ariaLabel'];
        assert.strictEqual(ariaLabelValue, `"a{b > c ? "": ""} c"`);
    });
});

describe('getAttributeContextAtPosition', () => {
    it('extract attribute name', () => {
        const document = setupDocument('<div disabled />');
        const result = getAttributeContextAtPosition(document, { line: 0, character: 6 });
        assert.strictEqual(result?.name, 'disabled');
        assert.strictEqual(result.inValue, false);
    });

    it('extract attribute after interpolated attribute', () => {
        const document = setupDocument('<Foo a={a > b} b= />');
        const result = getAttributeContextAtPosition(document, { line: 0, character: 17 });
        assert.strictEqual(result?.name, 'b');
        assert.strictEqual(result.inValue, true);
    });

    it('extract attribute value range', () => {
        const document = setupDocument('<Foo a="a > b" />');
        const result = getAttributeContextAtPosition(document, { line: 0, character: 8 });
        assert.strictEqual(result?.name, 'a');
        assert.strictEqual(result.inValue, true);
        assert.deepStrictEqual(result?.valueRange, [8, 13]);
    });

    function setupDocument(content: string) {
        return new Document('file:///test/Test.svelte', content);
    }
});
