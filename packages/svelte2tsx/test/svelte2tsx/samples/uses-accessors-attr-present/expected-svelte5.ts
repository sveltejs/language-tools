///<reference types="svelte" />
;function render() {

	 let foo: number = undefined/*Ωignore_startΩ*/;foo = __sveltets_2_any(foo);/*Ωignore_endΩ*/
	 let foo2 = undefined
	let clazz: string/*Ωignore_startΩ*/;clazz = __sveltets_2_any(clazz);/*Ωignore_endΩ*/
	
	 const bar: string = ''
;
async () => {  { svelteHTML.createElement("svelte:options", {"accessors":true,});}
};
return { props: {foo: foo , foo2: foo2 , class: clazz , bar: bar}, exports: /** @type {{foo: number,foo2: typeof foo2,class: string,bar: string}} */ ({}), bindings: "", slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_isomorphic_component(__sveltets_2_partial(['foo','foo2','bar'], __sveltets_2_with_any_event(render())));
/*Ωignore_startΩ*/type Input__SvelteComponent_ = InstanceType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;