///<reference types="svelte" />
<></>;function render() {
/*Ωignore_startΩ*/;const __sveltets_ensureSlot = __sveltets_1_createEnsureSlot();/*Ωignore_endΩ*/
<><Component>
    {() => { let {a} = /*Ωignore_startΩ*/new Component({target: __sveltets_1_any(''), props: {}})/*Ωignore_endΩ*/.$$slot_def['b'];<><div  >
        <slot a={__sveltets_ensureSlot("default","a",a)}></slot>
    </div></>}}
</Component></>
return { props: {}, slots: {'default': {a:__sveltets_1_instanceOf(Component).$$slot_def['b'].a}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}