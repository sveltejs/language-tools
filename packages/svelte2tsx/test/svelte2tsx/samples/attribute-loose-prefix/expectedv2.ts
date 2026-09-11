///<reference types="svelte" />
;
import Foo from './Foo.svelte';
function $$render() {

    
    let x = true;
;
async () => {

 { const $$_ooF0C = __sveltets_2_ensureComponent(Foo); new $$_ooF0C({ target: __sveltets_2_any(), props: {    ...__sveltets_2_empty({"mochi:hydrate":x}),...__sveltets_2_empty({"mochi:defer":true}),"prop":`a`,}});}
 { svelteHTML.createElement("div", { ...__sveltets_2_empty({"mochi:hydrate":x}),}); }};
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event($$render()))) {
}