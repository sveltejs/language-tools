///<reference types="svelte" />
<></>;function render() {
/*Ωignore_startΩ*/;const __sveltets_ensureSlot = __sveltets_createEnsureSlot();/*Ωignore_endΩ*/
<>{__sveltets_each(items, (item) => <>
    {__sveltets_each(item, ({ a }) => <>
        <slot a={__sveltets_ensureSlot("default","a",a)}>Hello</slot>
    </>)}
    <slot name="second" a={__sveltets_ensureSlot("second","a", a )}></slot>
</>)}
<Component >{() => { let {c} = /*Ωignore_startΩ*/new Component({target: __sveltets_any(''), props: {}})/*Ωignore_endΩ*/.$$slot_def['default'];<>{ c }</>}}</Component>
{() => {let _$$p = (promise); __sveltets_awaitThen(_$$p, (d) => {<>
    {d}
</>})}}
<slot name="third" d={__sveltets_ensureSlot("third","d",d)} c={__sveltets_ensureSlot("third","c",c)}></slot></>
return { props: {}, slots: {'default': {a:(({ a }) => a)(__sveltets_unwrapArr(__sveltets_unwrapArr(items)))}, 'second': {a:a}, 'third': {d:d, c:c}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render()))) {
}