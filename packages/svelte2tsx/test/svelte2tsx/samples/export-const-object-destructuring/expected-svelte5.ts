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
return { props: {a: a , b: b , c: c , g: g}, exports: /** @type {{a: typeof a,b: typeof b,c: typeof c,g: typeof g}} */ ({}), bindings: "", slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_isomorphic_component(__sveltets_2_partial(['a','b','c','g'], __sveltets_2_with_any_event(render())));
/*Ωignore_startΩ*/type Input__SvelteComponent_ = InstanceType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;