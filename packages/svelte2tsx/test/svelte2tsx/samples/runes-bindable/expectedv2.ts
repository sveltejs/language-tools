///<reference types="svelte" />
;function render() {

    let/** @typedef {{ a: unknown, b?: unknown }} $$ComponentProps *//** @type {$$ComponentProps} */ { a, b = $bindable() } = $props();
;
async () => {};
return { props: /** @type {__sveltets_2_Bindings<$$ComponentProps, "b">} */({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
    constructor(options = __sveltets_2_runes_constructor(__sveltets_2_partial(__sveltets_2_with_any_event(render())))) { super(options); }
}