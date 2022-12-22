///<reference types="svelte" />
<></>;function render() {
/*Ωignore_startΩ*/;const __sveltets_ensureSlot = __sveltets_1_createEnsureSlot();/*Ωignore_endΩ*/
<><Parent propA propB={propB} propC="val1" propD="val2" propE={`a${a}b${b}`} >{() => { let {foo} = /*Ωignore_startΩ*/new Parent({target: __sveltets_2_any(''), props: {'propA':true, 'propB':propB, 'propC':'val1', 'propD':"val2", 'propE':`a${a}b${b}`}})/*Ωignore_endΩ*/.$$slot_def['default'];<>
    <slot foo={__sveltets_ensureSlot("default","foo",foo)} />
</>}}</Parent></>
return { props: /** @type {Record<string, never>} */ ({}), slots: {'default': {foo:__sveltets_2_instanceOf(Parent).$$slot_def['default'].foo}}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}