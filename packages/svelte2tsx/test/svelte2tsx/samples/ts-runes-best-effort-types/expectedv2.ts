///<reference types="svelte" />
;function render() {
/*Ωignore_startΩ*/;type $$ComponentProps = { a: unknown, b?: boolean, c?: number, d?: string, e?: unknown, f?: unknown, g?: typeof foo, h?: Bar, i?: Baz };/*Ωignore_endΩ*/
    let { a, b = true, c = 1, d = '', e = null, f = {}, g = foo, h = null as Bar, i = null as any as Baz }: $$ComponentProps = $props(); 
;
async () => {};
return { props: {} as any as $$ComponentProps, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_with_any_event(render())) {
}