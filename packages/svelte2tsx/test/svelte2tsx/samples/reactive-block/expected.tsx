///<reference types="svelte" />
<></>;function render() {

let a: 1 | 2 = 1;
;() => {$: {
    console.log(a + 1);
}}
;
() => (<></>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(render)) {
}
