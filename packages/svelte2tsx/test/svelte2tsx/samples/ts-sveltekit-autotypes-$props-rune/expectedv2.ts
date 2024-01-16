///<reference types="svelte" />
;function render() {

     const snapshot/*Ωignore_startΩ*/: import('./$types.js').Snapshot/*Ωignore_endΩ*/ = {};
    let { form, data } = $props/*Ωignore_startΩ*/<{ data: import('./$types.js').PageData, form: import('./$types.js').ActionData }>/*Ωignore_endΩ*/();
;
async () => {};
return { props: {} as any as { data: import('./$types.js').PageData, form: import('./$types.js').ActionData } & { snapshot?: typeof snapshot }, slots: {}, events: {} }}

export default class Page__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_with_any_event(render())) {
    get snapshot() { return __sveltets_2_nonNullable(this.$$prop_def.snapshot) }
}