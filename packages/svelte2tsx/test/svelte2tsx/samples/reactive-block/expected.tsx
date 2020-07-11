<></>;function render() {

let a: 1 | 2 = 1;
;() => {$: {
    console.log(a + 1);
}}
;
<></>
return { props: {}, slots: {}, events: {} }}

export default class Input__SvelteComponent_ {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
    $on = __sveltets_eventDef(render().events).$on
}
