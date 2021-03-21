///<reference types="svelte" />
<></>;function render() {
<><Component   >{() => { let {name:n, thing, whatever:{ bla }} = __sveltets_instanceOf(Component).$$slot_def['default'];<>
    <slot n={n} thing={thing} bla={bla} />
</>}}</Component></>
return { props: {}, slots: {'default': {n:__sveltets_instanceOf(Component).$$slot_def['default'].name, thing:__sveltets_instanceOf(Component).$$slot_def['default'].thing, bla:(({ bla }) => bla)(__sveltets_instanceOf(Component).$$slot_def['default'].whatever)}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}