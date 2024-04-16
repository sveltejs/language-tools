///<reference types="svelte" />
;function render() {
/*Ωignore_startΩ*/;type $$ComponentProps = { a: unknown, b?: unknown };/*Ωignore_endΩ*/
    let { a, b = $bindable() }: $$ComponentProps = $props();
;
async () => {};
return { props: {} as any as __sveltets_2_Bindings<$$ComponentProps, "b">, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_with_any_event(render())) {
}