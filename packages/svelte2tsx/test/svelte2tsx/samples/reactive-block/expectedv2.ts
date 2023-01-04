///<reference types="svelte" />
;function render() {

let a: 1 | 2 = 1;
;() => {$: {
    console.log(a + 1);
}}
;
async () => {};
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}