///<reference types="svelte" />
;function render() {

	 let foo: number = undefined/*Ωignore_startΩ*/;foo = __sveltets_2_any(foo);/*Ωignore_endΩ*/
	 let foo2 = undefined
	let clazz: string/*Ωignore_startΩ*/;clazz = __sveltets_2_any(clazz);/*Ωignore_endΩ*/
	
	 const bar: string = ''
;
async () => { { svelteHTML.createElement("svelte:options", {  "accessors":true,});}
};
return { props: {foo: foo , foo2: foo2 , class: clazz , bar: bar}, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(['foo','foo2','bar'], __sveltets_2_with_any_event(render()))) {
    get bar() { return __sveltets_2_nonNullable(this.$$prop_def.bar) }
    get foo() { return this.$$prop_def.foo }
    /**accessor*/
    set foo(_) {}
    get foo2() { return this.$$prop_def.foo2 }
    /**accessor*/
    set foo2(_) {}
    get class() { return this.$$prop_def.class }
    /**accessor*/
    set class(_) {}
}