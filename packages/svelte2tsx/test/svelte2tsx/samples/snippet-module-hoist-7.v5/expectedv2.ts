///<reference types="svelte" />
;
    import { store2 } from './foo';
;;

import { store } from './foo';
function $$render() {
  const _foo/*Ωignore_positionΩ*/ = ()/*Ωignore_startΩ*/: ReturnType<import('svelte').Snippet>/*Ωignore_endΩ*/ => { async ()/*Ωignore_positionΩ*/ => {
    $store;
};return __sveltets_2_any(0)};  const _foo2/*Ωignore_positionΩ*/ = ()/*Ωignore_startΩ*/: ReturnType<import('svelte').Snippet>/*Ωignore_endΩ*/ => { async ()/*Ωignore_positionΩ*/ => {
    $store2;
};return __sveltets_2_any(0)};/*Ωignore_startΩ*/;let $store = __sveltets_2_store_get(store);/*Ωignore_endΩ*//*Ωignore_startΩ*/;let $store2 = __sveltets_2_store_get(store2);/*Ωignore_endΩ*/
    
;
async () => {





};
return { props: /** @type {Record<string, never>} */ ({}), exports: {}, bindings: "", slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_isomorphic_component(__sveltets_2_partial(__sveltets_2_with_any_event($$render())));
/*Ωignore_startΩ*/type Input__SvelteComponent_ = InstanceType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;