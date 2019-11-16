<></>;function render() {

;let b; $: b = 7;
let a;
$: a = 5;
;
<></>
return { props: {}, slots: {} }}

export default class {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
}