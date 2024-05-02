///<reference types="svelte" />
;function render() {

     const snapshot/*Ωignore_startΩ*/: import('./$types.js').Snapshot/*Ωignore_endΩ*/ = {};/*Ωignore_startΩ*/;type $$ComponentProps = { form: import('./$types.js').ActionData, data: import('./$types.js').PageData };/*Ωignore_endΩ*/
    let { form, data }: $$ComponentProps = $props();
;
async () => {};
return { props: {} as any as $$ComponentProps, exports: {} as any as { snapshot: typeof snapshot }, slots: {}, events: {} }}

export default class Page__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_with_any_event(render())) {
    constructor(options = __sveltets_2_runes_constructor(__sveltets_2_with_any_event(render()))) { super(options); }
    $$bindings = __sveltets_$$bindings('');
    get snapshot() { return render().exports.snapshot }
}