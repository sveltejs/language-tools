///<reference types="svelte" />
;;
type Props = {
    data: {cfg: string};
};;function $$render() {


let { data }: Props = $props();

type A = typeof data.cfg;
type B = (typeof data)['cfg'];
;
async () => {};
return { props: {} as any as Props, exports: {}, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_fn_component($$render());
/*Ωignore_startΩ*/type Input__SvelteComponent_ = ReturnType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;