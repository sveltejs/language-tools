<></>;function render() {

;let b; $: b = 7;
let a;
$: a = 5;
;
<></>
return { props: {}, slots: {} }}

export default class {
    $$prop_def = render().props
    $$slot_def = render().slots
}