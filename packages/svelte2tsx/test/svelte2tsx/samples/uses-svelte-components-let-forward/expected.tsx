///<reference types="svelte" />
<></>;function render() {
/*Ωignore_startΩ*/;const __sveltets_ensureSlot = __sveltets_1_createEnsureSlot();/*Ωignore_endΩ*/
<>{(true) ? <>
<svelteself >{() => { let {prop} = __sveltets_2_instanceOf(__sveltets_1_componentType()).$$slot_def['default'];/*Ωignore_startΩ*/((true)) && /*Ωignore_endΩ*/<>
    <slot prop={__sveltets_ensureSlot("default","prop",prop)} />
</>}}</svelteself>
</> : <></>}
<sveltecomponent this={testComponent} >{() => { let {prop} = __sveltets_2_instanceOf(__sveltets_1_componentType()).$$slot_def['default'];<>
    <slot prop={__sveltets_ensureSlot("default","prop",prop)} />
</>}}</sveltecomponent></>
return { props: /** @type {Record<string, never>} */ ({}), slots: {'default': {prop:__sveltets_2_instanceOf(__sveltets_1_componentType()).$$slot_def['default'].prop}}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}