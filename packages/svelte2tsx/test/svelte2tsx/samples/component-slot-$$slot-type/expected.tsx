///<reference types="svelte" />
<></>;function render() {

    type $$Slots = {
        default: {
            a: number;
        },
        foo: {
            b: number
        }
    }
    let b = 7;

/*Ωignore_startΩ*/;const __sveltets_ensureSlot = __sveltets_1_createEnsureSlot<$$Slots>();/*Ωignore_endΩ*/;
() => (<>

<div>
    <slot a={__sveltets_ensureSlot("default","a",b)} />
    <slot name="foo" b={__sveltets_ensureSlot("foo","b",b)} />
</div></>);
return { props: /** @type {Record<string, never>} */ ({}), slots: {} as unknown as $$Slots, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}