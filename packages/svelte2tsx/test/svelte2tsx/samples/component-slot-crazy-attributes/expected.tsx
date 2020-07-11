<></>;function render() {

    let b = 7;
;
<>
<div>
    <slot a={b} b={b} c="b" d={`a${b}`} e={b} >Hello</slot>
</div></>
return { props: {}, slots: {default: {a:b, b:b, c:"b", d:"__svelte_ts_string", e:b}}, events: {} }}

export default class Input__SvelteComponent_ {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
    $on = __sveltets_eventDef(render().events).$on
}
