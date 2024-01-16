///<reference types="svelte" />
;function render() {

    type $$Props = {
        exported1: string;
        exported2?: string;
        name1?: string;
        name2: string;
        renamed1?: string;
        renamed2: string;
    }
;
async () => {};
return { props: { ...__sveltets_2_ensureRightProps<{}>(__sveltets_2_any("") as $$Props)} as $$Props, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_with_any_event(render())) {
}