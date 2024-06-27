///<reference types="svelte" />
;function render() {

	 let foo: number = undefined/*Ωignore_startΩ*/;foo = __sveltets_2_any(foo);/*Ωignore_endΩ*/;
;
async () => {};
return { props: {foo: foo}, exports: /** @type {{foo: number}} */ ({}), bindings: "", slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_isomorphic_component(__sveltets_2_partial(['foo'], __sveltets_2_with_any_event(render())));
/*Ωignore_startΩ*/type Input__SvelteComponent_ = InstanceType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;