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
async () => {  { svelteHTML.createElement("svelte:options", {"runes":true,});}

};
return { props: /** @type {Record<string, never>} */ ({}), exports: /** @type {{name1: typeof name1,name2: typeof name2,renamed1: typeof rename1,renamed2: typeof rename2,Foo: typeof Foo,bar: typeof bar,baz: typeof baz,RenamedFoo: typeof RenameFoo,renamedbar: typeof renamebar,renamedbaz: typeof renamebaz}} */ ({}), bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_fn_component(render());
type Input__SvelteComponent_ = ReturnType<typeof Input__SvelteComponent_>;
export default Input__SvelteComponent_;