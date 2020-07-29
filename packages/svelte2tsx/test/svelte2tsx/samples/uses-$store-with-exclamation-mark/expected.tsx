<></>;
import { writable } from 'svelte/store';
function render() {

  
  const count = writable(0);
  const handler1 = () => !__sveltets_store_get(count)
;
() => (<>

<button onclick={() => !__sveltets_store_get(count)}>add</button></>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
    $on = __sveltets_eventDef(render().events)
}
