<></>;function render() {

    let b = 7;
;
<>
<div>
    <slot a={b}>Hello</slot>
</div></>
return { props: {}, slots: {default: {a:b}} }}

export default class {
    $$prop_def = render().props
    $$slot_def = render().slots
}