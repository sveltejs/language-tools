///<reference types="svelte" />
;
import { writable } from 'svelte/store';
function render() {

  
  const count = writable(0)/*Ωignore_startΩ*/;let $count = __sveltets_1_store_get(count);/*Ωignore_endΩ*/;
  let myvar = 42 // to show that this is different from ++ or --
  const handler1 = () => count.set( $count + myvar)
  const handler2 = () => count.set( $count - myvar)
  const handler3 = () => count.set( $count * myvar)
  const handler4 = () => count.set( $count / myvar)
  const handler5 = () => count.set( $count ** myvar)
  const handler6 = () => count.set( $count % myvar)
  const handler7 = () => count.set( $count << myvar)
  const handler8 = () => count.set( $count >> myvar)
  const handler9 = () => count.set( $count >>> myvar)
  const handler10 = () => count.set( $count & myvar)
  const handler11 = () => count.set( $count ^ myvar)
  const handler12 = () => count.set( $count | myvar)
;
async () => {

 { svelteHTML.createElement("button", {  "onclick":() => count.set( $count + myvar),});  }
 { svelteHTML.createElement("button", {  "onclick":() => count.set( $count - myvar),});  }
 { svelteHTML.createElement("button", {  "onclick":() => count.set( $count * myvar),});  }
 { svelteHTML.createElement("button", {  "onclick":() => count.set( $count / myvar),});  }
 { svelteHTML.createElement("button", {  "onclick":() => count.set( $count ** myvar),});  }
 { svelteHTML.createElement("button", {  "onclick":() => count.set( $count % myvar),});  }
 { svelteHTML.createElement("button", {  "onclick":() => count.set( $count << myvar),});  }
 { svelteHTML.createElement("button", {  "onclick":() => count.set( $count >> myvar),});  }
 { svelteHTML.createElement("button", {  "onclick":() => count.set( $count >>> myvar),});  }
 { svelteHTML.createElement("button", {  "onclick":() => count.set( $count & myvar),});  }
 { svelteHTML.createElement("button", {  "onclick":() => count.set( $count ^ myvar),});  }
 { svelteHTML.createElement("button", {  "onclick":() => count.set( $count | myvar),});  }};
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}