///<reference types="svelte" />
<></>;function render() {

    let name1: string = "world"
    let name2: string;

    let rename1: string = '';
    let rename2: string;

    class Foo {}
    function bar() {}
    const baz: string = '';

    class RenameFoo {}
    function renamebar() {}
    const renamebaz: string = '';

    
;
() => (<></>);
return { props: {name1: name1 , name2: name2 , renamed1: rename1 , renamed2: rename2 , Foo: Foo , bar: bar , baz: baz , RenamedFoo: RenameFoo , renamedbar: renamebar , renamedbaz: renamebaz} as {name1?: string, name2: string, renamed1?: string, renamed2: string, Foo?: typeof Foo, bar?: typeof bar, baz?: string, RenamedFoo?: typeof RenameFoo, renamedbar?: typeof renamebar, renamedbaz?: string}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_with_any_event(render())) {
}