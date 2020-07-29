<></>;
import { readable } from 'svelte/store';
function render() {

	
	const store = readable(Promise.resolve('test'), () => {});
;
() => (<>

{() => {let _$$p = (__sveltets_store_get(store)); <>
	<p>loading</p>
</>; _$$p.then((data) => {<>
	{data}
</>})}}</>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
    $on = __sveltets_eventDef(render().events)
}
