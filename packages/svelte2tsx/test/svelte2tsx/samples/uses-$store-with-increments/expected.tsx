///<reference types="svelte" />
<></>;
import { writable } from 'svelte/store';
function render() {

  
  const count = writable(0)/*Ωignore_startΩ*/;let $count = __sveltets_1_store_get(count);/*Ωignore_endΩ*/;
  const handler1 = () => count.set( $count + 1)
  const handler2 = () => count.set( $count - 1)
;
() => (<>

<button onclick={() => count.set( $count + 1)}>add</button>
<button onclick={() => count.set( $count - 1)}>subtract</button>
<button onclick={() => count.set( $count + 1)}>add</button></>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}