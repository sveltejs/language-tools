///<reference types="svelte" />
<></>;function render() {
<><Component>
    {() => { let {a} = /*Ωignore_startΩ*/new Component({target: __sveltets_any(''), props: {}})/*Ωignore_endΩ*/.$$slot_def['b'];<><div  >
        <slot a={a}></slot>
    </div></>}}
</Component></>
return { props: {}, slots: {'default': {a:__sveltets_instanceOf(Component).$$slot_def['b'].a}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render()))) {
}