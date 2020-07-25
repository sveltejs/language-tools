<></>;function render() {

    interface A {}
     let a: A;
     let b: A = {};b = __sveltets_any(b);;
;
<></>
return { props: {a: a , b: b} as {a: A, b?: A}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
    $on = __sveltets_eventDef(render().events).$on
}
