<></>;import Test from './Test.svelte';
function render() {

     
;
<><Test b="6" ></Test> 
</>
return { props: {}, slots: {}, events: {} }}

export default class Input__SvelteComponent_ {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
    $on = __sveltets_eventDef(render().events).$on
}
