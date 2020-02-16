<></>;function render() {

    interface A {}
     let a: A;
;
<></>
return { props: {a: a as A}, slots: {} }}

export default class {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
}
