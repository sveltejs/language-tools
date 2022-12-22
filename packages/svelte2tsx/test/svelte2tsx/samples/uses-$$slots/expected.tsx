///<reference types="svelte" />
<></>;function render() { let $$slots = __sveltets_2_slotsType({'foo': '', 'dashed-name': '', 'default': ''});
/*Ωignore_startΩ*/;const __sveltets_ensureSlot = __sveltets_1_createEnsureSlot();/*Ωignore_endΩ*/
<><h1>{$$slots.foo}</h1>
<h1>{$$slots['dashed-name']}</h1>

<slot name="foo" />
<slot name="dashed-name" />
<slot /></>
return { props: /** @type {Record<string, never>} */ ({}), slots: {'foo': {}, 'dashed-name': {}, 'default': {}}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}