///<reference types="svelte" />
<></>;function render() {

    let name1 = "world"
    let name2/*Ωignore_startΩ*/;name2 = __sveltets_2_any(name2);/*Ωignore_endΩ*/

    let rename1 = '';
    let rename2/*Ωignore_startΩ*/;rename2 = __sveltets_2_any(rename2);/*Ωignore_endΩ*/;

    class Foo {}
    function bar() {}
    const baz = '';

    class RenameFoo {}
    function renamebar() {}
    const renamebaz = '';

    
;
() => (<></>);
return { props: {name1: name1 , name2: name2 , renamed1: rename1 , renamed2: rename2 , Foo: Foo , bar: bar , baz: baz , RenamedFoo: RenameFoo , renamedbar: renamebar , renamedbaz: renamebaz}, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(['name1','renamed1','Foo','bar','baz','RenamedFoo','renamedbar','renamedbaz'], __sveltets_2_with_any_event(render()))) {
}