///<reference types="svelte" />
<></>;function render() {
<>{(true) ? <>
<svelteself >{() => { let {prop} = __sveltets_instanceOf(__sveltets_componentType()).$$slot_def['default'];/*Ωignore_startΩ*/((true)) && /*Ωignore_endΩ*/<>
    <slot prop={prop} />
</>}}</svelteself>
</> : <></>}
<sveltecomponent this={testComponent} >{() => { let {prop} = __sveltets_instanceOf(__sveltets_componentType()).$$slot_def['default'];<>
    <slot prop={prop} />
</>}}</sveltecomponent></>
return { props: {}, slots: {'default': {prop:__sveltets_instanceOf(__sveltets_componentType()).$$slot_def['default'].prop}}, getters: {}, setters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}