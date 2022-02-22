///<reference types="svelte" />
<></>;function render() {

    let name1 = "world"
    let name2

    let rename1 = '';
    let rename2;

    class Foo {}
    function bar() {}
    const baz = '';

    class RenameFoo {}
    function renamebar() {}
    const renamebaz = '';

    
;
() => (<></>);
return { props: {name1: name1 , name2: name2 , renamed1: rename1 , renamed2: rename2 , Foo: Foo , bar: bar , baz: baz , RenamedFoo: RenameFoo , renamedbar: renamebar , renamedbaz: renamebaz}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(['name1','renamed1','Foo','bar','baz','RenamedFoo','renamedbar','renamedbaz'], __sveltets_1_with_any_event(render()))) {
}