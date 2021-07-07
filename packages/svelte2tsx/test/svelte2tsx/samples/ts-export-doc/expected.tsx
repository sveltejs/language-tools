///<reference types="svelte" />
<></>;function render() {

    /**
     * DOCS!
     */
     let a: string;
    /**
     * MORE DOCS!
     */
     let b = 1;
     let c;

    // not this one
     let d;
;
() => (<></>);
return { props: {a: a , b: b , c: c , d: d} as {
/**
     * DOCS!
     */a: string, 
/**
     * MORE DOCS!
     */b?: typeof b, c: typeof c, d: typeof d}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_with_any_event(render())) {
}