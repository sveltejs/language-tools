///<reference types="svelte" />
;function $$render() {
  const generic/*Ωignore_positionΩ*/ = <T extends string>(val: T)/*Ωignore_startΩ*/: ReturnType<import('svelte').Snippet>/*Ωignore_endΩ*/ => { async ()/*Ωignore_positionΩ*/ => {
	val;
};return __sveltets_2_any(0)};  const complex_generic/*Ωignore_positionΩ*/ = <T extends { bracket: "<" } | "<" | Set<"<>">>(val: T)/*Ωignore_startΩ*/: ReturnType<import('svelte').Snippet>/*Ωignore_endΩ*/ => { async ()/*Ωignore_positionΩ*/ => {
	val;
};return __sveltets_2_any(0)};
;
async () => {



};
return { props: /** @type {Record<string, never>} */ ({}), exports: {}, bindings: "", slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_isomorphic_component(__sveltets_2_partial(__sveltets_2_with_any_event($$render())));
/*Ωignore_startΩ*/type Input__SvelteComponent_ = InstanceType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;