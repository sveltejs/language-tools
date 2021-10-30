///<reference types="svelte" />
<></>;function render() {
<><div {...__sveltets_1_empty(__sveltets_1_store_get(compile_options), $compile_options=__sveltets_1_instanceOf(HTMLDivElement).offsetHeight)} />
<div {...__sveltets_1_empty((__sveltets_1_store_get(compile_options), $compile_options).foo=__sveltets_1_instanceOf(HTMLDivElement).offsetHeight)} />
<div {...__sveltets_1_empty(__sveltets_1_store_get(compile_options), $compile_options = /*Ωignore_startΩ*/__sveltets_1_instanceOf(__sveltets_1_ctorOf(__sveltets_1_mapElementTag('div')))/*Ωignore_endΩ*/)} />
<div {...__sveltets_1_empty((__sveltets_1_store_get(compile_options), $compile_options).foo = /*Ωignore_startΩ*/__sveltets_1_instanceOf(__sveltets_1_ctorOf(__sveltets_1_mapElementTag('div')))/*Ωignore_endΩ*/)} />
<div noAssignment={(__sveltets_1_store_get(compile_options), $compile_options)} />
<div noAssignment={(__sveltets_1_store_get(compile_options), $compile_options).foo} /></>
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}