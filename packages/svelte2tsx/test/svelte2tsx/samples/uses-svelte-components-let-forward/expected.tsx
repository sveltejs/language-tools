///<reference types="svelte" />
<></>;function render() {
/*Ωignore_startΩ*/;const __sveltets_ensureSlot = __sveltets_createEnsureSlot();/*Ωignore_endΩ*/
<>{(true) ? <>
<svelteself >{() => { let {prop} = __sveltets_instanceOf(__sveltets_componentType()).$$slot_def['default'];/*Ωignore_startΩ*/((true)) && /*Ωignore_endΩ*/<>
    <slot prop={__sveltets_ensureSlot("default","prop",prop)} />
</>}}</svelteself>
</> : <></>}
<sveltecomponent this={testComponent} >{() => { let {prop} = __sveltets_instanceOf(__sveltets_componentType()).$$slot_def['default'];<>
    <slot prop={__sveltets_ensureSlot("default","prop",prop)} />
</>}}</sveltecomponent></>
return { props: {}, slots: {'default': {prop:__sveltets_instanceOf(__sveltets_componentType()).$$slot_def['default'].prop}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render()))) {
}