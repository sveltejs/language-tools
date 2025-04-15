///<reference types="svelte" />
;function $$render() {

    const a = 1;

interface A {
    Abc: typeof a
}

interface Abc {
    foo: A.Abc
}

let {}: Abc = $props();
;
async () => {};
return { props: {} as any as Abc, exports: {}, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_fn_component($$render());
type Input__SvelteComponent_ = ReturnType<typeof Input__SvelteComponent_>;
export default Input__SvelteComponent_;