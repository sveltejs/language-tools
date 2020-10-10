///<reference types="svelte" />
<></>;
import { writable } from 'svelte/store';
function render() {

  
  const count = writable(0);
  const handler1 = () => !__sveltets_store_get(count)
;const __svelte_store_get_values__ = {count:__sveltets_store_get(count),};

() => (<>

<button onclick={() => !__svelte_store_get_values__['count']}>add</button></>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}
