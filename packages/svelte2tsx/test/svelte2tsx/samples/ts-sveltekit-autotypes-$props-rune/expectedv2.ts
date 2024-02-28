///<reference types="svelte" />
;function render() {

     const snapshot/*Ωignore_startΩ*/: import('./$types.js').Snapshot/*Ωignore_endΩ*/ = {};/*Ωignore_startΩ*/;type $$_sveltets_Props = { form: import('./$types.js').ActionData, data: import('./$types.js').PageData };/*Ωignore_endΩ*/
    let { form, data } = $props<$$_sveltets_Props>();
;
async () => {};
return { props: {} as any as $$_sveltets_Props & { snapshot?: typeof snapshot }, slots: {}, events: {} }}

export default class Page__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_with_any_event(render())) {
    get snapshot() { return __sveltets_2_nonNullable(this.$$prop_def.snapshot) }
}