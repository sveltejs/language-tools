///<reference types="svelte" />
<></>;function render() {
<><h1 onclick={ () => {

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

}}>Hi</h1></>
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}