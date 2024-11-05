///<reference types="svelte" />
;function render() {

let  { a } = __sveltets_2_invalidate(() => ({ a: '' }));
let  { b: d } = __sveltets_2_invalidate(() => ({ b: '' }));
let  { c: { length } } = __sveltets_2_invalidate(() => ({ c: '' }));
let  { ...e } = __sveltets_2_invalidate(() => ({ f: ''}));
let  { f } = __sveltets_2_invalidate(() => ({ f: ''}));
let  { b: g = 1} = __sveltets_2_invalidate(() => ({ b: 1 }));
;
async () => {};
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}