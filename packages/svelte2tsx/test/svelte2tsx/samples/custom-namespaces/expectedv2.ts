///<reference types="svelte" />
;
import Counter from './Counter.svelte';
function $$render() {

    
    let count = 5;
;
async () => {


  { const $$_retnuoC0C = __sveltets_2_ensureComponent(Counter); new $$_retnuoC0C({ target: __sveltets_2_any(), props: {...__sveltets_2_empty({"mochi:hydrate":true}),}});}
 { const $$_retnuoC0C = __sveltets_2_ensureComponent(Counter); new $$_retnuoC0C({ target: __sveltets_2_any(), props: {  ...__sveltets_2_empty({"mochi:defer":count}),}});}
  { const $$_retnuoC0C = __sveltets_2_ensureComponent(Counter); new $$_retnuoC0C({ target: __sveltets_2_any(), props: {...__sveltets_2_empty({"mochi":true}),}});}


 { svelteHTML.createElement("div", {...__sveltets_2_empty({"mochi:foo":true}),});  }
 { svelteHTML.createElement("div", { ...__sveltets_2_empty({"mochi:bar":count}),}); }
 { svelteHTML.createElement("div", {...__sveltets_2_empty({"mochi":true}),}); }};
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event($$render()))) {
}