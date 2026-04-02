///<reference types="svelte" />
;
;;;

interface B<T> {};;
interface A extends B<A> {
    Abc: A
    [key: string]: A
};function $$render() {




let {Abc}: A = $props()
;
async () => {

};
return { props: {} as any as A, exports: {}, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_fn_component($$render());
/*Ωignore_startΩ*/type Input__SvelteComponent_ = ReturnType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;