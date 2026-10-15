///<reference types="svelte" />
;function $$render() {

	 let foo: number = undefined/*Ωignore_startΩ*/;foo = __sveltets_2_any();foo;/*Ωignore_endΩ*/
	 const bar: string = ''
;
async () => {};
return { props: {foo: foo , bar: bar}, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(['foo','bar'], __sveltets_2_with_any_event($$render()))) {
    get bar() { return __sveltets_2_nonNullable(this.$$prop_def.bar) }
}