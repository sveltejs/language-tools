///<reference types="svelte" />
;function render() {

    /**
     * DOCS!
     */
     let a: string/*Ωignore_startΩ*/;a = __sveltets_2_any(a);/*Ωignore_endΩ*/;
    /**
     * MORE DOCS!
     */
     let b = 1;
     let c/*Ωignore_startΩ*/;c = __sveltets_2_any(c);/*Ωignore_endΩ*/;

    // not this one
     let d/*Ωignore_startΩ*/;d = __sveltets_2_any(d);/*Ωignore_endΩ*/;
;
async () => {};
return { props: {a: a , b: b , c: c , d: d} as {
/**
     * DOCS!
     */a: string, 
/**
     * MORE DOCS!
     */b?: typeof b, c: typeof c, d: typeof d}, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_with_any_event(render())) {
}