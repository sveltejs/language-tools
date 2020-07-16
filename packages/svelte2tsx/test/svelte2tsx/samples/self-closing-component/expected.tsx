<></>;import Test from './Test.svelte';
function render() {


let a = 'b';
;
() => (<><Test b="6" />
</>);
return { props: {}, slots: {} }}

export default class Input__SvelteComponent_ {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
}
