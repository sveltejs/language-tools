///<reference types="svelte" />
;function render() {

const array = [1, 2, 3, [4]];

 const [a, b, c, [d]] = array;
;
async () => {};
return { props: {a: a , b: b , c: c , d: d}, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(['a','b','c','d'], __sveltets_2_with_any_event(render()))) {
}