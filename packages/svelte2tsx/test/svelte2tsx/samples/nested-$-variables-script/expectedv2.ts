///<reference types="svelte" />
;function render() {

let top1 = someStore()/*Ωignore_startΩ*/;let $top1 = __sveltets_2_store_get(top1);/*Ωignore_endΩ*/
let top2 = someStore()/*Ωignore_startΩ*/;let $top2 = __sveltets_2_store_get(top2);/*Ωignore_endΩ*/
let topLevelGet = $top1
topLevelGet = $top2

function test(top1) {
    let passedGet = $top1
}

function test2($top1) {
    let paramShadowed = $top1
}

function test3() {
    let $top2 = "hi"
    let letshadowed = $top2
}

const test4 = ({a,  b: { $top1: $top2 }}) => $top2 && $top1

;
async () => {};
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}