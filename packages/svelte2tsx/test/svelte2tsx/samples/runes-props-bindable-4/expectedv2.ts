///<reference types="svelte" />
;function render() {

    /** @typedef {{ a: string; b?: number }} Foo */

    /** @type {Foo} */
    let { b = 1 } = $props();

    /** @type {Foo} */
    let { a } = $props.bindable();
;
async () => {};
return { props: /** @type {Foo} */({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}