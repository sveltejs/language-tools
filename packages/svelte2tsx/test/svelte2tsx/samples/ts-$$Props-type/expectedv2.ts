///<reference types="svelte" />
;function render() {


    interface $$Props {
        exported1: string;
        exported2?: string;
        name1?: string;
        name2: string;
        renamed1?: string;
        renamed2: string;
    }

     let exported1: string/*Ωignore_startΩ*/;exported1 = __sveltets_2_any(exported1);/*Ωignore_endΩ*/;
     let exported2: string = ''/*Ωignore_startΩ*/;exported2 = __sveltets_2_any(exported2);/*Ωignore_endΩ*/;

    let name1: string = "world"/*Ωignore_startΩ*/;name1 = __sveltets_2_any(name1);/*Ωignore_endΩ*/
    let name2: string/*Ωignore_startΩ*/;name2 = __sveltets_2_any(name2);/*Ωignore_endΩ*/;

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
return { props: { ...__sveltets_2_ensureRightProps<{exported1: string,exported2?: string,name1?: string,name2: string,renamed1?: string,renamed2: string}>(__sveltets_2_any("") as $$Props)} as {Foo?: typeof Foo,bar?: typeof bar,baz?: string,RenamedFoo?: typeof RenameFoo,renamedbar?: typeof renamebar,renamedbaz?: string} & $$Props, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_with_any_event(render())) {
}