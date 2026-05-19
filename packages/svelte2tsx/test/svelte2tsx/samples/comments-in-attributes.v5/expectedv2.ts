///<reference types="svelte" />
;function $$render() {

    let x = $state();
;
async () => {

 {
// action comment
const $$action_0 = __sveltets_2_ensureAction(action(svelteHTML.mapElementTag('div'),(params)));{ const $$_div0 = svelteHTML.createElement("div", __sveltets_2_union($$action_0), {                        
// comment
"foo":`bar`,"x":true,// comment same line
/* another comment */
"baz":`qux`,
// event handler comment
"on:click":handler,
// attachment comment
[Symbol("@attach")]:attachment,
// spread comment
...spread_props,"trailing":true // trailing comment same line
,});
// transition comment
__sveltets_2_ensureTransition(fade(svelteHTML.mapElementTag('div')));
// animation comment
__sveltets_2_ensureAnimation(flip(svelteHTML.mapElementTag('div'),__sveltets_2_AnimationMove));
// binding comment
element = $$_div0; }}

 { const $$_tnenopmoC0C = __sveltets_2_ensureComponent(Component); const $$_tnenopmoC0 = new $$_tnenopmoC0C({ target: __sveltets_2_any(), props: {                    
// comment
"foo":`bar`,
/* another comment */
"baz":`qux`,
// attachment comment
[Symbol("@attach")]:attachment,
// binding comment
prop:bound_prop,
// spread comment
...spread_props,"trailing":true
// trailing comment newline
,}});/*Ωignore_startΩ*/() => bound_prop = __sveltets_2_any(null);/*Ωignore_endΩ*/$$_tnenopmoC0.$$bindings = 'prop';
// event handler comment
$$_tnenopmoC0.$on("click", handler);{const {/*Ωignore_startΩ*/$$_$$/*Ωignore_endΩ*/,
// let comment
item,} = $$_tnenopmoC0.$$slot_def.default;$$_$$; }Component}};
return { props: /** @type {Record<string, never>} */ ({}), exports: {}, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_fn_component($$render());
/*Ωignore_startΩ*/type Input__SvelteComponent_ = ReturnType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;