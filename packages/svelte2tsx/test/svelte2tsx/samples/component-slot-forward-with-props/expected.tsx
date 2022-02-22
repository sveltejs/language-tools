///<reference types="svelte" />
<></>;function render() {
/*Ωignore_startΩ*/;const __sveltets_ensureSlot = __sveltets_1_createEnsureSlot();/*Ωignore_endΩ*/
<><Parent propA propB={propB} propC="val1" propD="val2" propE={`a${a}b${b}`} >{() => { let {foo} = /*Ωignore_startΩ*/new Parent({target: __sveltets_1_any(''), props: {'propA':true, 'propB':propB, 'propC':'val1', 'propD':"val2", 'propE':`a${a}b${b}`}})/*Ωignore_endΩ*/.$$slot_def['default'];<>
    <slot foo={__sveltets_ensureSlot("default","foo",foo)} />
</>}}</Parent></>
return { props: {}, slots: {'default': {foo:__sveltets_1_instanceOf(Parent).$$slot_def['default'].foo}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}