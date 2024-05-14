///<reference types="svelte" />
;function render() {

    /** @typedef {{a: number, b: string}}  $$ComponentProps *//** @type {$$ComponentProps} */
    let { a, b } = $props();
    let x = $state(0);
    let y = $derived(x * 2);
;
async () => {};
return { props: /** @type {$$ComponentProps} */({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
    constructor(options = __sveltets_2_runes_constructor(__sveltets_2_partial(__sveltets_2_with_any_event(render())))) { super(options); }
    $$bindings = __sveltets_$$bindings('');
}