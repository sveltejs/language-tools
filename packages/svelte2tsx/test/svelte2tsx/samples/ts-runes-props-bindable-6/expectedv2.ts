///<reference types="svelte" />
;function render() {
/*Ωignore_startΩ*/;type $$ComponentProps = { b?: number };/*Ωignore_endΩ*/
    let { b = 1 }: $$ComponentProps = $props();/*Ωignore_startΩ*/;type $$ComponentBindableProps = { a: unknown };/*Ωignore_endΩ*/
    let { a }: $$ComponentBindableProps = $props.bindable();
;
async () => {};
return { props: {} as any as $$ComponentProps & $$ComponentBindableProps, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_with_any_event(render())) {
}