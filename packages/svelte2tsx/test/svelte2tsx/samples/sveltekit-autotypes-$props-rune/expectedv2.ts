///<reference types="svelte" />
;function render() {

    let/** @type {{ data: import('./$types.js').PageData, form: import('./$types.js').ActionData }} */ { form, data } = $props();
     const snapshot/*Ωignore_startΩ*/: import('./$types.js').Snapshot/*Ωignore_endΩ*/ = {};

    /** @type {{form: boolean, data: true }} */
    let { form, data } = $props();
;
async () => {};
return { props: /** @type {{form: boolean, data: true }} */({}), slots: {}, events: {} }}

export default class Page__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(['snapshot'], __sveltets_2_with_any_event(render()))) {
    get snapshot() { return __sveltets_2_nonNullable(this.$$prop_def.snapshot) }
}