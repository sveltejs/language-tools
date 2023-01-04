///<reference types="svelte" />
;
import { writable } from 'svelte/store';
function render() {

  
  const count = writable(0)/*Ωignore_startΩ*/;let $count = __sveltets_2_store_get(count);/*Ωignore_endΩ*/;
  const handler1 = () => !$count
  const handler2 = () => +$count
  const handler3 = () => -$count
  const handler4 = () => ~$count
;
async () => {

 { svelteHTML.createElement("button", {  "on:click":() => !$count,});  }
 { svelteHTML.createElement("button", {  "on:click":() => +$count,});  }
 { svelteHTML.createElement("button", {  "on:click":() => -$count,});  }
 { svelteHTML.createElement("button", {  "on:click":() => ~$count,});  }};
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}