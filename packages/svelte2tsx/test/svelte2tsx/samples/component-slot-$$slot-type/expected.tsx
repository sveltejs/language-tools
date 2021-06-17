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

/*Ωignore_startΩ*/;const __sveltets_ensureSlot = __sveltets_createEnsureSlot<$$Slots>();/*Ωignore_endΩ*/;
() => (<>

<div>
    <slot a={__sveltets_ensureSlot("default","a",b)} />
    <slot name="foo" b={__sveltets_ensureSlot("foo","b",b)} />
</div></>);
return { props: {}, slots: {} as unknown as $$Slots, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render()))) {
}