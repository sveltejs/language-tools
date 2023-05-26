///<reference types="svelte" />
;function render() {

const obj = {
    a: 1,
    b: 2,
    nested: {
        c: 3,
        d: 4,
    },
};

 const {
    a, b, nested: { c, d: g }
} = obj;
;
async () => {};
return { props: {a: a , b: b , c: c , g: g}, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(['a','b','c','g'], __sveltets_2_with_any_event(render()))) {
}