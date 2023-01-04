///<reference types="svelte" />
<></>;function render() {
/*Ωignore_startΩ*/;const __sveltets_ensureSlot = __sveltets_1_createEnsureSlot();/*Ωignore_endΩ*/
<>{__sveltets_1_each(items, (item) => <>
    {__sveltets_1_each(item, ({ a }) => <>
        <slot a={__sveltets_ensureSlot("default","a",a)}>Hello</slot>
    </>)}
    <slot name="second" a={__sveltets_ensureSlot("second","a", a )}></slot>
</>)}
<Component >{() => { let {c} = /*Ωignore_startΩ*/new Component({target: __sveltets_2_any(''), props: {}})/*Ωignore_endΩ*/.$$slot_def['default'];<>{ c }</>}}</Component>
{() => {let _$$p = (promise); __sveltets_1_awaitThen(_$$p, (d) => {<>
    {d}
</>})}}
<slot name="third" d={__sveltets_ensureSlot("third","d",d)} c={__sveltets_ensureSlot("third","c",c)}></slot></>
return { props: /** @type {Record<string, never>} */ ({}), slots: {'default': {a:(({ a }) => a)(__sveltets_2_unwrapArr(__sveltets_2_unwrapArr(items)))}, 'second': {a:a}, 'third': {d:d, c:c}}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}