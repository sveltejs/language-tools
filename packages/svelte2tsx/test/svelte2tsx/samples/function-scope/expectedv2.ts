///<reference types="svelte" />
;function render() {

    let callback = (id) => undefined;
    class B {
        constructor(id) { }

        method(id) { }

        set id(id) { }
    }

    let  { id } = __sveltets_2_invalidate(() => ({ id: '' }));
;
async () => {};
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}