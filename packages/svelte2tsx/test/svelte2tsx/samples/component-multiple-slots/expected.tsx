///<reference types="svelte" />
<></>;function render() {

    let b = 7;
    let d = 5;
    let e = 5;

/*Ωignore_startΩ*/;const __sveltets_ensureSlot = __sveltets_1_createEnsureSlot();/*Ωignore_endΩ*/;
() => (<>
<div>
    <slot a={__sveltets_ensureSlot("default","a",b)}>Hello</slot>
    <slot name="test" c={__sveltets_ensureSlot("test","c",d)} e={__sveltets_ensureSlot("test","e",e)}></slot>
    <slot name="abc-cde.113"></slot>
</div></>);
return { props: {}, slots: {'default': {a:b}, 'test': {c:d, e:e}, 'abc-cde.113': {}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}