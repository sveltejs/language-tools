<></>;import { writable } from 'svelte/store';
function render() {

  
  const count = writable(0);
  const handler1 = () => count.set( __sveltets_store_get(count) + 1)
  const handler2 = () => count.set( __sveltets_store_get(count) - 1)
;
<>

<button onclick={() => count.set( __sveltets_store_get(count) + 1)}>add</button>
<button onclick={() => count.set( __sveltets_store_get(count) - 1)}>subtract</button></>
return { props: {}, slots: {} }}

export default class Input__SvelteComponent_ {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
}