<></>;import { writable } from 'svelte/store';
function render() {

  
  const count = writable(0);
  let myvar = 42 // to show that this is different from ++ or --
  const handler1 = () => count.set( __sveltets_store_get(count) + myvar)
  const handler2 = () => count.set( __sveltets_store_get(count) - myvar)
  const handler3 = () => count.set( __sveltets_store_get(count) * myvar)
  const handler4 = () => count.set( __sveltets_store_get(count) / myvar)
  const handler5 = () => count.set( __sveltets_store_get(count) ** myvar)
  const handler6 = () => count.set( __sveltets_store_get(count) % myvar)
  const handler7 = () => count.set( __sveltets_store_get(count) << myvar)
  const handler8 = () => count.set( __sveltets_store_get(count) >> myvar)
  const handler9 = () => count.set( __sveltets_store_get(count) >>> myvar)
  const handler10 = () => count.set( __sveltets_store_get(count) & myvar)
  const handler11 = () => count.set( __sveltets_store_get(count) ^ myvar)
  const handler12 = () => count.set( __sveltets_store_get(count) | myvar)
;
<>

<button onclick={() => count.set( __sveltets_store_get(count) + myvar)}>add</button>
<button onclick={() => count.set( __sveltets_store_get(count) - myvar)}>subtract</button>
<button onclick={() => count.set( __sveltets_store_get(count) * myvar)}>multiply</button>
<button onclick={() => count.set( __sveltets_store_get(count) / myvar)}>divide</button>
<button onclick={() => count.set( __sveltets_store_get(count) ** myvar)}>exponent</button>
<button onclick={() => count.set( __sveltets_store_get(count) % myvar)}>mod</button>
<button onclick={() => count.set( __sveltets_store_get(count) << myvar)}>leftshift</button>
<button onclick={() => count.set( __sveltets_store_get(count) >> myvar)}>rightshift</button>
<button onclick={() => count.set( __sveltets_store_get(count) >>> myvar)}>unsigned rightshift</button>
<button onclick={() => count.set( __sveltets_store_get(count) & myvar)}>AND</button>
<button onclick={() => count.set( __sveltets_store_get(count) ^ myvar)}>XOR</button>
<button onclick={() => count.set( __sveltets_store_get(count) | myvar)}>OR</button></>
return { props: {}, slots: {} }}

export default class {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
}