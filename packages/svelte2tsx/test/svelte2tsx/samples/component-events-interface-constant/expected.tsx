///<reference types="svelte" />
<></>;function render() {

    const A = 'a';
    const B = 'b', C = 'c';
    interface $$Events {
        /**
         * Some doc
         */
        [A]: boolean;
        [B]: string;
        [C];
    }
;
() => (<></>);
return { props: {}, slots: {}, getters: {}, events: {} as unknown as $$Events }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(render())) {
}