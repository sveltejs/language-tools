///<reference types="svelte" />
;function render() {
/*Ωignore_startΩ*/;type $$ComponentBindableProps = { a: unknown, b?: number };/*Ωignore_endΩ*/
    let { a, b = 1 }: $$ComponentBindableProps = $props.bindable();
;
async () => {};
return { props: {} as any as $$ComponentBindableProps, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_with_any_event(render())) {
}