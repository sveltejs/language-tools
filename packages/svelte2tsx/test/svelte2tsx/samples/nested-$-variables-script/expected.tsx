///<reference types="svelte" />
<></>;function render() {

let top1 = someStore()/*Ωignore_startΩ*/;let $top1 = __sveltets_store_get(top1);/*Ωignore_endΩ*/
let top2 = someStore()/*Ωignore_startΩ*/;let $top2 = __sveltets_store_get(top2);/*Ωignore_endΩ*/
let topLevelGet = (__sveltets_store_get(top1), $top1)
topLevelGet = (__sveltets_store_get(top2), $top2)

function test(top1) {
    let passedGet = (__sveltets_store_get(top1), $top1)
}

function test2($top1) {
    let paramShadowed = $top1
}

function test3() {
    let $top2 = "hi"
    let letshadowed = $top2
}

const test4 = ({a,  b: { $top1: $top2 }}) => $top2 && (__sveltets_store_get(top1), $top1)

;
() => (<></>);
return { props: {}, slots: {}, getters: {}, setters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}