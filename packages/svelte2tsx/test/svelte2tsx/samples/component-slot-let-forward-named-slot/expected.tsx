///<reference types="svelte" />
<></>;function render() {
<><Component>
    <div  >{() => { let {a} = __sveltets_instanceOf(Component).$$slot_def.b;<>
        <slot a={a}></slot>
    </>}}</div>
</Component></>
return { props: {}, slots: {default: {a:__sveltets_instanceOf(Component).$$slot_def.b.a}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}
