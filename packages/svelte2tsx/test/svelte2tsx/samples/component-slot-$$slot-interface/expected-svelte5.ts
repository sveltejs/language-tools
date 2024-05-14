///<reference types="svelte" />
;function render() {

    interface $$Slots {
        default: {
            a: number;
        },
        foo: {
            b: number
        }
    }
    let b = 7;

/*Ωignore_startΩ*/;const __sveltets_createSlot = __sveltets_2_createCreateSlot<$$Slots>();/*Ωignore_endΩ*/;
async () => {

 { svelteHTML.createElement("div", {});
     { __sveltets_createSlot("default", {  "a":b,});}
     { __sveltets_createSlot("foo", {   b,});}
 }};
return { props: /** @type {Record<string, never>} */ ({}), slots: {} as unknown as $$Slots, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}