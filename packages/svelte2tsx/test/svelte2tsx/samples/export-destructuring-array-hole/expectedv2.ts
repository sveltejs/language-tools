///<reference types="svelte" />
;function $$render() {

    const o = { a: 1, b: { c: 2, d: [3, 4, 5] }, e: [6] };

     let { a, b: { c, d: [d_one, , d_three] }, e: [e_one] } = o;
     const { a: A, b: { c: C } } = o;
;
async () => {};
return { props: {a: a , c: c , d_one: d_one , d_three: d_three , e_one: e_one , A: A , C: C}, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(['a','c','d_one','d_three','e_one','A','C'], __sveltets_2_with_any_event($$render()))) {
}