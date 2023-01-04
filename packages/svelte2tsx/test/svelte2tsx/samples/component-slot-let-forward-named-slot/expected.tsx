///<reference types="svelte" />
<></>;function render() {
/*Ωignore_startΩ*/;const __sveltets_ensureSlot = __sveltets_1_createEnsureSlot();/*Ωignore_endΩ*/
<><Component>
    {() => { let {a} = /*Ωignore_startΩ*/new Component({target: __sveltets_2_any(''), props: {}})/*Ωignore_endΩ*/.$$slot_def['b'];<><div  >
        <slot a={__sveltets_ensureSlot("default","a",a)}></slot>
    </div></>}}
</Component></>
return { props: /** @type {Record<string, never>} */ ({}), slots: {'default': {a:__sveltets_2_instanceOf(Component).$$slot_def['b'].a}}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}