///<reference types="svelte" />
<></>;function render() {

    const uid = readable('')/*Ωignore_startΩ*/;let $uid = __sveltets_1_store_get(uid);/*Ωignore_endΩ*/
    let  foo1 = __sveltets_1_invalidate(() => getFoo1((__sveltets_1_store_get(uid), $uid)));/*Ωignore_startΩ*/;let $foo1 = __sveltets_1_store_get(foo1);/*Ωignore_endΩ*/
    ;() => {$: console.log({ foo1: (__sveltets_1_store_get(foo1), $foo1) });}
    
    let  foo2 = __sveltets_1_invalidate(() => getFoo2((__sveltets_1_store_get(uid), $uid)))/*Ωignore_startΩ*/;let $foo2 = __sveltets_1_store_get(foo2);/*Ωignore_endΩ*/
    ;() => {$: console.log({ foo2: (__sveltets_1_store_get(foo2), $foo2) })}

    let  {foo3} = __sveltets_1_invalidate(() => getFoo3((__sveltets_1_store_get(uid), $uid)));/*Ωignore_startΩ*/;let $foo3 = __sveltets_1_store_get(foo3);/*Ωignore_endΩ*/
    ;() => {$: console.log({ foo3: (__sveltets_1_store_get(foo3), $foo3) });}
    
    let  {foo4} = __sveltets_1_invalidate(() => getFoo4((__sveltets_1_store_get(uid), $uid)))/*Ωignore_startΩ*/;let $foo4 = __sveltets_1_store_get(foo4);/*Ωignore_endΩ*/
    ;() => {$: console.log({ foo4: (__sveltets_1_store_get(foo4), $foo4) })}
;
() => (<></>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}