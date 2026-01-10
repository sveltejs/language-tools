///<reference types="svelte" />
;
    let value = 1;
;;;
    type NoComma = true;;
    type Dependency = {
        a: number;
        b: typeof value;
        c: NoComma
    };;

    /** A comment */
    interface Props<T> {
        a: Dependency;
        b: T;
    };function $$render() {





    let { a, b }: Props<boolean> = $props();
;
async () => {

};
return { props: {} as any as Props<boolean>, exports: {}, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_fn_component($$render());
/*Ωignore_startΩ*/type Input__SvelteComponent_ = ReturnType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;