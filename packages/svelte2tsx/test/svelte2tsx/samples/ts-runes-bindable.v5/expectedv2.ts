///<reference types="svelte" />
;function render() {
/*Ωignore_startΩ*/;type $$ComponentProps = { a: unknown, b?: unknown, c?: number };/*Ωignore_endΩ*/
    let { a, b = $bindable(), c = $bindable(0) as number }: $$ComponentProps = $props();
;
async () => {};
return { props: {} as any as $$ComponentProps, exports: {}, bindings: __sveltets_$$bindings('b', 'c'), slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_fn_component(render());
export default Input__SvelteComponent_;