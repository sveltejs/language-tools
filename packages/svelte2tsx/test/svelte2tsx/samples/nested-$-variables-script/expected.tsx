<></>;function render() {

let top1 = someStore()
let top2 = someStore()
let topLevelGet = __sveltets_store_get(top1)
topLevelGet = __sveltets_store_get(top2)

function test(top1) {
    let passedGet = __sveltets_store_get(top1)
}

function test2($top1) {
    let paramShadowed = $top1
}

function test3() {
    let $top2 = "hi"
    let letshadowed = $top2
}

const test4 = ({a,  b: { $top1: $top2 }}) => $top2 && __sveltets_store_get(top1)

;
() => (<></>);
return { props: {}, slots: {} }}

export default class Input__SvelteComponent_ {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
}
