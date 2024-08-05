///<reference types="svelte" />
;function render() {

const array = [1, 2, 3, [4]];

 const [a, b, c, [d]] = array;
;
async () => {};
return { props: {a: a , b: b , c: c , d: d}, exports: /** @type {{a: typeof a,b: typeof b,c: typeof c,d: typeof d}} */ ({}), bindings: "", slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_isomorphic_component(__sveltets_2_partial(['a','b','c','d'], __sveltets_2_with_any_event(render())));
/*Ωignore_startΩ*/type Input__SvelteComponent_ = InstanceType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;