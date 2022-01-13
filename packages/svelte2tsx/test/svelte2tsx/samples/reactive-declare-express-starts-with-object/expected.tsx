///<reference types="svelte" />
<></>;function render() {


let  b = __sveltets_1_invalidate(() => ({ a: 1 }['a']));
let  c = __sveltets_1_invalidate(() => ({ a: { b: 1} }['a']['b']));
let  d = __sveltets_1_invalidate(() => ({ a: { b: 1} }['a']['b']?.['c']));
let  e = __sveltets_1_invalidate(() => ({a: 1} ?? { a: 1 }));
let  f = __sveltets_1_invalidate(() => ({a: 1}[c] ? '' : '1'));
;
() => (<></>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}