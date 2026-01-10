///<reference types="svelte" />
;function $$render() {
/*Ωignore_startΩ*/;type $$ComponentProps = { a: any, b?: boolean, c?: number, d?: string, e?: any, f?: Record<string, any>, g?: typeof foo, h?: Bar, i?: Baz, j?: any[], k?: any, l?: any, m?: number, n?: Function };/*Ωignore_endΩ*/
    let { a, b = true, c = 1, d = '', e = null, f = {}, g = foo, h = null as Bar, i = null as any as Baz, j = [], k = undefined, l = $bindable(), m = $bindable(1), n = () => {} }: $$ComponentProps = $props()/*Ωignore_startΩ*/;l;m;/*Ωignore_endΩ*/; 
;
async () => {};
return { props: {} as any as $$ComponentProps, exports: {}, bindings: __sveltets_$$bindings('l', 'm'), slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_fn_component($$render());
/*Ωignore_startΩ*/type Input__SvelteComponent_ = ReturnType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;