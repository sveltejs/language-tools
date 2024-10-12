///<reference types="svelte" />
;function render() {

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
async () => {};
return { props: {name1: name1 , name2: name2 , renamed1: rename1 , renamed2: rename2 , Foo: Foo , bar: bar , baz: baz , RenamedFoo: RenameFoo , renamedbar: renamebar , renamedbaz: renamebaz}, exports: /** @type {{Foo: typeof Foo,bar: typeof bar,baz: typeof baz,RenamedFoo: typeof RenameFoo,renamedbar: typeof renamebar,renamedbaz: typeof renamebaz}} */ ({}), bindings: "", slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_isomorphic_component(__sveltets_2_partial(['name1','renamed1','Foo','bar','baz','RenamedFoo','renamedbar','renamedbaz'], __sveltets_2_with_any_event(render())));
/*Ωignore_startΩ*/type Input__SvelteComponent_ = InstanceType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;