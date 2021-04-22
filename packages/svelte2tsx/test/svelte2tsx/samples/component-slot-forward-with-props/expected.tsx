///<reference types="svelte" />
<></>;function render() {
<><Parent propA propB={propB} propC="val1" propD="val2" propE={`a${a}b${b}`} >{() => {/*Ωignore_startΩ*/const ΨpropE=("a") + (a) + ("b") + (b);/*Ωignore_endΩ*/() => { let {foo} = /*Ωignore_startΩ*/new Parent({target: __sveltets_any(''), props: {'propA':true, 'propB':propB, 'propC':"val1", 'propD':"val2", 'propE':ΨpropE}})/*Ωignore_endΩ*/.$$slot_def['default'];<>
    <slot foo={foo} />
</>}}}</Parent></>
return { props: {}, slots: {'default': {foo:__sveltets_instanceOf(Parent).$$slot_def['default'].foo}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}