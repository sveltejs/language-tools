///<reference types="svelte" />
;
    import Child from "./Child.svelte";
function $$render() {

    let value = $state("");
;
async () => {

 { const $$_dlihC0C = __sveltets_2_ensureComponent(Child); const $$_dlihC0 = new $$_dlihC0C({ target: __sveltets_2_any(), props: {    value,other:value,}});/*Ωignore_startΩ*/() => value = __sveltets_2_any(null);/*Ωignore_endΩ*/$$_dlihC0.$$bindings = 'value';/*Ωignore_startΩ*/() => value = __sveltets_2_any(null);/*Ωignore_endΩ*/$$_dlihC0.$$bindings = 'other';}};
return { props: {} as Record<string, never>, exports: {}, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_fn_component($$render());
/*Ωignore_startΩ*/type Input__SvelteComponent_ = ReturnType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;