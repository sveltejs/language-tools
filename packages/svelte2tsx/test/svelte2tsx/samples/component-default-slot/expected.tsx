<></>;function render() {

    let b = 7;
;
<>
<div>
    <slot a={b}>Hello</slot>
</div></>
return { props: {}, slots: {default: {a:b}} }}

export default class Input__SvelteComponent_ {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
}