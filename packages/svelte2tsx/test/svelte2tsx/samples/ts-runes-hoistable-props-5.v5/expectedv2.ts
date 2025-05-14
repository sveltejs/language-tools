///<reference types="svelte" />
;
    import X from './X';
;;

import { readable } from 'svelte/store';
;
 
    /** I should not be sandwitched between the imports */
    interface Props {
        foo?: string;
    };function $$render() {

    
    
    const store = readable(1)/*Ωignore_startΩ*/;let $store = __sveltets_2_store_get(store);/*Ωignore_endΩ*/

    let { foo }: Props = $props()
;
async () => {



$store;};
return { props: {} as any as Props, exports: {}, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_fn_component($$render());
/*Ωignore_startΩ*/type Input__SvelteComponent_ = ReturnType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;