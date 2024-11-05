///<reference types="svelte" />
;function render() {
async () => { { const $$_div0 = svelteHTML.createElement("div", {  });$compile_options= $$_div0.offsetHeight;}
 { const $$_div0 = svelteHTML.createElement("div", {  });$compile_options.foo= $$_div0.offsetHeight;}
 { const $$_div0 = svelteHTML.createElement("div", {  });$compile_options = $$_div0;}
 { const $$_div0 = svelteHTML.createElement("div", {  });$compile_options.foo = $$_div0;}
 { svelteHTML.createElement("div", {  "bind:noAssignment":$compile_options,});/*Ωignore_startΩ*/() => $compile_options = __sveltets_2_any(null);/*Ωignore_endΩ*/}
 { svelteHTML.createElement("div", {  "bind:noAssignment":$compile_options.foo,});/*Ωignore_startΩ*/() => $compile_options.foo = __sveltets_2_any(null);/*Ωignore_endΩ*/}};
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}