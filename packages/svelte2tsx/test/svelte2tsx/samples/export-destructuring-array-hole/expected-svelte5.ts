///<reference types="svelte" />
;function $$render() {

    const o = { a: 1, b: { c: 2, d: [3, 4, 5] }, e: [6] };

     let { a, b: { c, d: [d_one, , d_three] }, e: [e_one] } = o;
     const { a: A, b: { c: C } } = o;
;
async () => {};
return { props: {a: a , c: c , d_one: d_one , d_three: d_three , e_one: e_one , A: A , C: C}, exports: /** @type {{A: typeof A,C: typeof C}} */ ({}), bindings: "", slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_isomorphic_component(__sveltets_2_partial(['a','c','d_one','d_three','e_one','A','C'], __sveltets_2_with_any_event($$render())));
/*Ωignore_startΩ*/type Input__SvelteComponent_ = InstanceType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;