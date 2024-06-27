///<reference types="svelte" />
;function render() {

    let name1: string = "world"/*Ωignore_startΩ*/;name1 = __sveltets_2_any(name1);/*Ωignore_endΩ*/
    let name2: string/*Ωignore_startΩ*/;name2 = __sveltets_2_any(name2);/*Ωignore_endΩ*/;
    let name3: string = ''/*Ωignore_startΩ*/;name3 = __sveltets_2_any(name3);/*Ωignore_endΩ*/;let  name4: string/*Ωignore_startΩ*/;name4 = __sveltets_2_any(name4);/*Ωignore_endΩ*/;

    let rename1: string = ''/*Ωignore_startΩ*/;rename1 = __sveltets_2_any(rename1);/*Ωignore_endΩ*/;
    let rename2: string/*Ωignore_startΩ*/;rename2 = __sveltets_2_any(rename2);/*Ωignore_endΩ*/;

    class Foo {}
    function bar() {}
    const baz: string = '';

    class RenameFoo {}
    function renamebar() {}
    const renamebaz: string = '';

    
;
async () => {};
return { props: {name1: name1 , name2: name2 , name3: name3 , name4: name4 , renamed1: rename1 , renamed2: rename2 , Foo: Foo , bar: bar , baz: baz , RenamedFoo: RenameFoo , renamedbar: renamebar , renamedbaz: renamebaz} as {name1?: string, name2: string, name3?: string, name4: string, renamed1?: string, renamed2: string, Foo?: typeof Foo, bar?: typeof bar, baz?: string, RenamedFoo?: typeof RenameFoo, renamedbar?: typeof renamebar, renamedbaz?: string}, exports: {} as any as { Foo: typeof Foo,bar: typeof bar,baz: string,RenamedFoo: typeof RenameFoo,renamedbar: typeof renamebar,renamedbaz: string }, bindings: "", slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_isomorphic_component(__sveltets_2_with_any_event(render()));
/*Ωignore_startΩ*/type Input__SvelteComponent_ = InstanceType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;