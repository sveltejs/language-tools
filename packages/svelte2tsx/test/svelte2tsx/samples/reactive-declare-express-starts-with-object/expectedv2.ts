///<reference types="svelte" />
;function render() {


let  b = __sveltets_2_invalidate(() => ({ a: 1 }['a']));
let  c = __sveltets_2_invalidate(() => ({ a: { b: 1} }['a']['b']));
let  d = __sveltets_2_invalidate(() => ({ a: { b: 1} }['a']['b']?.['c']));
let  e = __sveltets_2_invalidate(() => ({a: 1} ?? { a: 1 }));
let  f = __sveltets_2_invalidate(() => ({a: 1}[c] ? '' : '1'));
;
async () => {};
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}