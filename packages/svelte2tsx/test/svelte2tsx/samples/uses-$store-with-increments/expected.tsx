///<reference types="svelte" />
<></>;
import { writable } from 'svelte/store';
function render() {

  
  const count = writable(0);
  const handler1 = () => count.set( __sveltets_store_get(count) + 1)
  const handler2 = () => count.set( __sveltets_store_get(count) - 1)
;
() => (<>

<button onclick={() => count.set( __sveltets_store_get(count) + 1)}>add</button>
<button onclick={() => count.set( __sveltets_store_get(count) - 1)}>subtract</button></>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(render)) {
}
