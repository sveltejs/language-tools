///<reference types="svelte" />
;function render() {

    /** @typedef {{form: boolean, data: true }}  $$ComponentProps *//** @type {$$ComponentProps} */
    let { form, data } = $props();
    /** @type {any} */
     const snapshot = {};
;
async () => {};
return { props: /** @type {$$ComponentProps} */({}), exports: /** @type {snapshot: typeof snapshot} */ ({}), slots: {}, events: {} }}

export default class Page__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
    constructor(options = __sveltets_2_runes_constructor(__sveltets_2_partial(__sveltets_2_with_any_event(render())))) { super(options); }
    $$bindings = __sveltets_$$bindings('');
    get snapshot() { return render().exports.snapshot }
}