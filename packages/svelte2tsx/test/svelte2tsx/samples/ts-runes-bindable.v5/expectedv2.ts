///<reference types="svelte" />
;function $$render() {
/*Ωignore_startΩ*/;type $$ComponentProps = { a: any, b?: any, c?: number };/*Ωignore_endΩ*/
    let { a, b = $bindable(), c = $bindable(0) as number }: $$ComponentProps = $props()/*Ωignore_startΩ*/;b;c;/*Ωignore_endΩ*/;
;
async () => {};
return { props: {} as any as $$ComponentProps, exports: {}, bindings: __sveltets_$$bindings('b', 'c'), slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_fn_component($$render());
/*Ωignore_startΩ*/type Input__SvelteComponent_ = ReturnType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;