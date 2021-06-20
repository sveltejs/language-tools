///<reference types="svelte" />
<></>;function render() {

    interface $$Slots {
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
return { props: {}, slots: {} as unknown as $$Slots, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}