///<reference types="svelte" />
;
    import { writable } from 'svelte/store';
function $$render() {

    let a = 1;
    const b = 2;
    const store = writable(0)/*Ωignore_startΩ*/;let $store = __sveltets_2_store_get(store);/*Ωignore_endΩ*/;
    ;() => {$: __sveltets_2_any(a), (b, __sveltets_2_any(0)), __sveltets_2_any($store), console.log('changed');}
    ;() => {$: a;}
;
async () => {};
return { props: {} as Record<string, never>, exports: {}, bindings: "", slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_isomorphic_component(__sveltets_2_with_any_event($$render()));
/*Ωignore_startΩ*/type Input__SvelteComponent_ = InstanceType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;