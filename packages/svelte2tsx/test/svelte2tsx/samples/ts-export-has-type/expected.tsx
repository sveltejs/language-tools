///<reference types="svelte" />
<></>;function render() {

    interface A {}
     let a: A/*Ωignore_startΩ*/;a = __sveltets_1_any(a);/*Ωignore_endΩ*/;
     let b: A = {}/*Ωignore_startΩ*/;b = __sveltets_1_any(b);/*Ωignore_endΩ*/;
;
() => (<></>);
return { props: {a: a , b: b} as {a: A, b?: A}, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_with_any_event(render())) {
}