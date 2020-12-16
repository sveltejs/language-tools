///<reference types="svelte" />
<></>;
import { writable } from 'svelte/store';
function render() {

  
  const count = writable(0);;let $count = __sveltets_store_get(count);
  const handler1 = () => !(__sveltets_store_get(count), $count)
;
() => (<>

<button onclick={() => !(__sveltets_store_get(count), $count)}>add</button></>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}
