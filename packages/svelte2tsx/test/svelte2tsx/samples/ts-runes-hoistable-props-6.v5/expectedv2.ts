///<reference types="svelte" />
;;
    interface A {
        type: string;
    };;

    interface Props extends A {
        a: string;
    };function $$render() {



    const { }: Props = $props();
;
async () => {};
return { props: {} as any as Props, exports: {}, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_fn_component($$render());
type Input__SvelteComponent_ = ReturnType<typeof Input__SvelteComponent_>;
export default Input__SvelteComponent_;