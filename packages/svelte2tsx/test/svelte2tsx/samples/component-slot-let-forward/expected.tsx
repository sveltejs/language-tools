///<reference types="svelte" />
<></>;function render() {
/*Ωignore_startΩ*/;const __sveltets_ensureSlot = __sveltets_1_createEnsureSlot();/*Ωignore_endΩ*/
<><Component   >{() => { let {name:n, thing, whatever:{ bla }} = /*Ωignore_startΩ*/new Component({target: __sveltets_2_any(''), props: {}})/*Ωignore_endΩ*/.$$slot_def['default'];<>
    <slot n={__sveltets_ensureSlot("default","n",n)} thing={__sveltets_ensureSlot("default","thing",thing)} bla={__sveltets_ensureSlot("default","bla",bla)} />
</>}}</Component></>
return { props: /** @type {Record<string, never>} */ ({}), slots: {'default': {n:__sveltets_2_instanceOf(Component).$$slot_def['default'].name, thing:__sveltets_2_instanceOf(Component).$$slot_def['default'].thing, bla:(({ bla }) => bla)(__sveltets_2_instanceOf(Component).$$slot_def['default'].whatever)}}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}