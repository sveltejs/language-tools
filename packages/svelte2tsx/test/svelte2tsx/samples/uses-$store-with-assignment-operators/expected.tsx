///<reference types="svelte" />
<></>;
import { writable } from 'svelte/store';
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
;const __svelte_store_get_values__ = {count:__sveltets_store_get(count),};

() => (<>

<button onclick={() => count.set( __svelte_store_get_values__['count'] + myvar)}>add</button>
<button onclick={() => count.set( __svelte_store_get_values__['count'] - myvar)}>subtract</button>
<button onclick={() => count.set( __svelte_store_get_values__['count'] * myvar)}>multiply</button>
<button onclick={() => count.set( __svelte_store_get_values__['count'] / myvar)}>divide</button>
<button onclick={() => count.set( __svelte_store_get_values__['count'] ** myvar)}>exponent</button>
<button onclick={() => count.set( __svelte_store_get_values__['count'] % myvar)}>mod</button>
<button onclick={() => count.set( __svelte_store_get_values__['count'] << myvar)}>leftshift</button>
<button onclick={() => count.set( __svelte_store_get_values__['count'] >> myvar)}>rightshift</button>
<button onclick={() => count.set( __svelte_store_get_values__['count'] >>> myvar)}>unsigned rightshift</button>
<button onclick={() => count.set( __svelte_store_get_values__['count'] & myvar)}>AND</button>
<button onclick={() => count.set( __svelte_store_get_values__['count'] ^ myvar)}>XOR</button>
<button onclick={() => count.set( __svelte_store_get_values__['count'] | myvar)}>OR</button></>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}
