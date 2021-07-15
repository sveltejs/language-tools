///<reference types="svelte" />
<></>;function render() {


    interface $$Props {
        exported1: string;
        exported2?: string;
        name1?: string;
        name2: string;
        renamed1?: string;
        renamed2: string;
    }

     let exported1: string;
     let exported2: string = '';exported2 = __sveltets_1_any(exported2);;

    let name1: string = "world";name1 = __sveltets_1_any(name1);
    let name2: string;

    let rename1: string = '';rename1 = __sveltets_1_any(rename1);;
    let rename2: string;

    class Foo {}
    function bar() {}
    const baz: string = '';

    class RenameFoo {}
    function renamebar() {}
    const renamebaz: string = '';

    
;
() => (<></>);
return { props: {...__sveltets_1_ensureRightProps<{exported1: string,exported2?: string,name1?: string,name2: string,renamed1?: string,renamed2: string}>(__sveltets_1_any("") as $$Props), ...__sveltets_1_ensureRightProps<Partial<$$Props>>({exported1: exported1,exported2: exported2,name1: name1,name2: name2,renamed1: rename1,renamed2: rename2}), ...{} as unknown as $$Props, ...{Foo: Foo, bar: bar, baz: baz, RenamedFoo: RenameFoo, renamedbar: renamebar, renamedbaz: renamebaz} as {Foo?: typeof Foo,bar?: typeof bar,baz?: string,RenamedFoo?: typeof RenameFoo,renamedbar?: typeof renamebar,renamedbaz?: string}}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_with_any_event(render())) {
}