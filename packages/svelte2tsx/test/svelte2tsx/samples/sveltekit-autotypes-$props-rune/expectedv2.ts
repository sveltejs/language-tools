///<reference types="svelte" />
;function render() {

    let/** @typedef {{ form: import('./$types.js').ActionData, data: import('./$types.js').PageData }} $$ComponentProps *//** @type {$$ComponentProps} */ { form, data } = $props();
     const snapshot/*Ωignore_startΩ*/: import('./$types.js').Snapshot/*Ωignore_endΩ*/ = {};
;
async () => {};
return { props: /** @type {$$ComponentProps} */({}), exports: /** @type {snapshot: typeof snapshot} */ ({}), slots: {}, events: {} }}

export default class Page__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
    constructor(options = __sveltets_2_runes_constructor(__sveltets_2_partial(__sveltets_2_with_any_event(render())))) { super(options); }
    get snapshot() { return render().exports.snapshot }
}