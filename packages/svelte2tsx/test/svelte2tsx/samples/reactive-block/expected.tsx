///<reference types="svelte" />
<></>;function render() {

let a: 1 | 2 = 1;
;() => {$: {
    console.log(a + 1);
}}
;
() => (<></>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}