<></>;function render() {

    interface A {}
     let a: A;
;
<></>
return { props: {a: a} as {a: A}, slots: {} }}

export default class input {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
}
