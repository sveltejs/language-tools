///<reference types="svelte" />
;function render() {

    let/** @typedef {{ form: import('./$types.js').ActionData, data: import('./$types.js').PageData }} $$_sveltets_Props *//** @type {$$_sveltets_Props} */ { form, data } = $props();
     const snapshot/*Ωignore_startΩ*/: import('./$types.js').Snapshot/*Ωignore_endΩ*/ = {};
;
async () => {};
return { props: /** @type {{snapshot?: typeof snapshot} & $$_sveltets_Props} */({}), slots: {}, events: {} }}

export default class Page__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(['snapshot'], __sveltets_2_with_any_event(render()))) {
    get snapshot() { return __sveltets_2_nonNullable(this.$$prop_def.snapshot) }
}