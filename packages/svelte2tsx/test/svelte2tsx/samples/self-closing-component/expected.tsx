<></>;import Test from './Test.svelte';
function render() {


let a = 'b';
;
<><Test b="6" />
</>
return { props: {}, slots: {} }}

export default class {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
}