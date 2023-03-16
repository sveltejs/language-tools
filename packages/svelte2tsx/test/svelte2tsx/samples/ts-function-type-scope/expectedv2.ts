///<reference types="svelte" />
;function render() {

    let callback: (id: string) => void;
    let callback2: {( id: string): void}
    let constructor1: new (id: string) => { id: string };
    let obj: { hi(id: string): void }

    let  { id } = __sveltets_2_invalidate(() => ({ id: '' }));
;
async () => {};
return { props: {} as Record<string, never>, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_with_any_event(render())) {
}