<></>;function render() {

    let b = 7;
;
<>
<div>
    <slot a={b} b={b} c="b" d={`${"a"}${b}`} e={b} >Hello</slot>
</div></>
return { props: {}, slots: {default: {a:b, b:b, c:"b", d:`${"a"}${b}`, e:b}} }}

export default class {
    $$prop_def = render().props
    $$slot_def = render().slots
}