///<reference types="svelte" />
;function render() {

    /** @typedef {{a: number, b: string}}  $$_sveltets_Props *//** @type {$$_sveltets_Props} */
    let { a, b } = $props();
    let x = $state(0);
    let y = $derived(x * 2);
;
async () => {};
return { props: /** @type {$$_sveltets_Props} */({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}