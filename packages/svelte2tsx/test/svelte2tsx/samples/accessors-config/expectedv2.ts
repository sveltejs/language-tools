///<reference types="svelte" />
;function $$render() {

	 let foo: number = undefined/*Ωignore_startΩ*/;foo = __sveltets_2_any();foo;/*Ωignore_endΩ*/;
;
async () => {};
return { props: {foo: foo}, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(['foo'], __sveltets_2_with_any_event($$render()))) {
    get foo() { return this.$$prop_def.foo }
    /**accessor*/
    set foo(_) {}
}