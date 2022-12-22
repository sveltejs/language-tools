///<reference types="svelte" />
;function render() {
async () => { { svelteHTML.createElement("h1", {  "on:click":() => {

    // TODO: this is invalid Svelte right now, stores have to be top level 
    // it's therefore okay to not append "let top1$/top2$ = __svelte_store_get(..)"
    let top1 = someStore()
    let top2 = someStore()
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

},});  }};
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}