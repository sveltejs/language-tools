///<reference types="svelte" />
;function render() {

    type Foo = { a: string; b?: number }

    let { a, b = 1 }: Foo = $props.bindable();
;
async () => {};
return { props: {} as any as Foo, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_with_any_event(render())) {
}