///<reference types="svelte" />
;function render() {

const a = function (shadowed1) {}
const b = (shadowed2) => {}
let  c = __sveltets_1_invalidate(() => function (shadowed3) {})
let  d = __sveltets_1_invalidate(() => (shadowed4) => {})

let  shadowed1 = __sveltets_1_invalidate(() => 1)
let  shadowed2 = __sveltets_1_invalidate(() => 1)
let  shadowed3 = __sveltets_1_invalidate(() => 1)
let  shadowed4 = __sveltets_1_invalidate(() => 1)
;
async () => {};
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}