///<reference types="svelte" />
;function render() {

    /** @typedef {{form: boolean, data: true }}  $$ComponentProps *//** @type {$$ComponentProps} */
    let { form, data } = $props();
    /** @type {any} */
     const snapshot = {};
;
async () => {};
return { props: /** @type {{snapshot?: typeof snapshot} & $$ComponentProps} */({}), slots: {}, events: {} }}

export default class Page__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(['snapshot'], __sveltets_2_with_any_event(render()))) {
    constructor(options = __sveltets_2_runes_constructor(__sveltets_2_partial(['snapshot'], __sveltets_2_with_any_event(render())))) { super(options); }
    get snapshot() { return __sveltets_2_nonNullable(this.$$prop_def.snapshot) }
}