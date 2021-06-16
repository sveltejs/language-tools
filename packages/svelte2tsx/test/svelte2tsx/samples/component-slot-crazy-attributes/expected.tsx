///<reference types="svelte" />
<></>;function render() {

    let b = 7;

/*Ωignore_startΩ*/;const __sveltets_ensureSlot = __sveltets_createEnsureSlot();/*Ωignore_endΩ*/;
() => (<>
<div>
    <slot a={__sveltets_ensureSlot("default","a",b)} b={__sveltets_ensureSlot("default","b",b)} c={__sveltets_ensureSlot("default","c","b")} d={__sveltets_ensureSlot("default","d",`a${b}`)} e={__sveltets_ensureSlot("default","e",b)} >Hello</slot>
</div></>);
return { props: {}, slots: {'default': {a:b, b:b, c:"b", d:"__svelte_ts_string", e:b}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render()))) {
}