///<reference types="svelte" />
;function render() {

    let/** @typedef {{ a: unknown, b?: boolean, c?: number, d?: string, e?: unknown, f?: unknown, g?: typeof foo }} $$ComponentProps *//** @type {$$ComponentProps} */ { a, b = true, c = 1, d = '', e = null, f = {}, g = foo } = $props(); 
;
async () => {};
return { props: /** @type {$$ComponentProps} */({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_with_any_event(render())) {
    constructor(options = __sveltets_2_runes_constructor(__sveltets_2_with_any_event(render()))) { super(options); }
    $$bindings = __sveltets_$$bindings('');
}