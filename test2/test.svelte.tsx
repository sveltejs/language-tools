<></>;
    import Add from "./Add.svelte"
function render() {

    let b = "3"
;
<>

<Add number1={1} number2={"3"} />

</>
return { props: {}, slots: {} }}

export default class {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
}