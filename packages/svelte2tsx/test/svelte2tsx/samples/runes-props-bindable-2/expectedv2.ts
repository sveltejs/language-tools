///<reference types="svelte" />
;function render() {

    /** @typedef {{ a: string; b?: number }}  $$ComponentBindableProps *//** @type {$$ComponentBindableProps} */
    let { a, b = 1 } = $props.bindable();
;
async () => {};
return { props: /** @type {$$ComponentBindableProps} */({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}