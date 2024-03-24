///<reference types="svelte" />
;function render() {

    let/** @typedef {{ b?: number }} $$ComponentProps *//** @type {$$ComponentProps} */ { b = 1 } = $props();
    let/** @typedef {{ a: unknown }} $$ComponentBindableProps *//** @type {$$ComponentBindableProps} */ { a } = $props.bindable();
;
async () => {};
return { props: /** @type {$$ComponentBindableProps & $$ComponentProps} */({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}