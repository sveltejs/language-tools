///<reference types="svelte" />
;function render() {

     const snapshot: any = {};;type $$ComponentProps =  {form: boolean, data: true };
    let { form, data }:$$ComponentProps = $props();
;
async () => {};
return { props: {} as any as $$ComponentProps & { snapshot?: import("svelte").Binding<any> }, slots: {}, events: {} }}

export default class Page__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_with_any_event(render())) {
    constructor(options = __sveltets_2_runes_constructor(__sveltets_2_with_any_event(render()))) { super(options); }
    get snapshot() { return __sveltets_2_nonNullable(this.$$prop_def.snapshot) }
}