<></>;import { writable } from 'svelte/store';
function render() {

  
  const count = writable(0);
  let myvar = 4 + 8 + 15 + 16 + 23 + 42
  const handler1 = () => count.set( __sveltets_store_get(count) + myvar)
  const handler2 = () => count.set( __sveltets_store_get(count) - myvar)
  const handler3 = () => count.set( __sveltets_store_get(count) * myvar)
  const handler4 = () => count.set( __sveltets_store_get(count) / myvar)
  const handler5 = () => count.set( __sveltets_store_get(count) ** myvar)
  const handler6 = () => count.set( __sveltets_store_get(count) % myvar)
;
<>


<button onclick={() => count.set( __sveltets_store_get(count) + myvar)}>add</button>
<button onclick={() => count.set( __sveltets_store_get(count) - myvar)}>subtract</button>
<button onclick={() => count.set( __sveltets_store_get(count) * myvar)}>multiply</button>
<button onclick={() => count.set( __sveltets_store_get(count) / myvar)}>divide</button>
<button onclick={() => count.set( __sveltets_store_get(count) ** myvar)}>exponent</button>
<button onclick={() => count.set( __sveltets_store_get(count) % myvar)}>mod</button></>
return { props: {}, slots: {} }}

export default class {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
}