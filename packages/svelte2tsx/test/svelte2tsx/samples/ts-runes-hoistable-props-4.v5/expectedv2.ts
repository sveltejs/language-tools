///<reference types="svelte" />
;;
    interface Dependency {
        a: number;
    };;

    interface Props {
        [k: string]: Dependency;
    };function $$render() {




    let { foo }: Props = $props();
;
async () => {};
return { props: {} as any as Props, exports: {}, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_fn_component($$render());
/*Ωignore_startΩ*/type Input__SvelteComponent_ = ReturnType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;