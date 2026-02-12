///<reference types="svelte" />
;
/** @template T */
function $$render() {
 const foo/*Ωignore_positionΩ*/ = /** @returns {ReturnType<import('svelte').Snippet>} */ (bar) => { async ()/*Ωignore_positionΩ*/ => {
  bar;
};return __sveltets_2_any(0)};
  /** @typedef {{ b: T }} $$ComponentProps *//** @type {$$ComponentProps} */
  let { b } = $props();
  let rect;

/*Ωignore_startΩ*//** @type {ReturnType<typeof __sveltets_2_createCreateSlot>} */ const __sveltets_createSlot = __sveltets_2_createCreateSlot();/*Ωignore_endΩ*/;
async () => {



 { svelteHTML.createElement("div", { });rect= /*Ωignore_startΩ*//** @type {DOMRectReadOnly} */ (null)/*Ωignore_endΩ*/; }
 { __sveltets_createSlot("default", {}); }};
return { props: /** @type {$$ComponentProps} */({}), exports: {}, bindings: __sveltets_$$bindings(''), slots: {'default': {}}, events: {} }}
/** @template T */
class __sveltets_Render {
    /** @returns {ReturnType<typeof $$render<T>>['props']} */
    props() { return /** @type {any} */ (null); }
    /** @returns {ReturnType<typeof $$render<T>>['events']} */
    events() { return /** @type {any} */ (null); }
    /** @returns {ReturnType<typeof $$render<T>>['slots']} */
    slots() { return /** @type {any} */ (null); }
    bindings() { return __sveltets_$$bindings(''); }
    exports() { return {}; }
}

/** @template T */
/** @typedef {(new <T>(options: import('svelte').ComponentConstructorOptions<ReturnType<__sveltets_Render<T>['props']>& {children?: any}>) => import('svelte').SvelteComponent<ReturnType<__sveltets_Render<T>['props']>, ReturnType<__sveltets_Render<T>['events']>, ReturnType<__sveltets_Render<T>['slots']>> & { $$bindings?: ReturnType<__sveltets_Render<T>['bindings']> } & ReturnType<__sveltets_Render<T>['exports']>) & (<T>(internal: unknown, props: ReturnType<__sveltets_Render<T>['props']> & {$$slots?: ReturnType<__sveltets_Render<T>['slots']>, children?: any}) => ReturnType<__sveltets_Render<T>['exports']>) & {z_$$bindings?: ReturnType<__sveltets_Render<any>['bindings']>}} $$IsomorphicComponent */
/** @type {$$IsomorphicComponent} */ export const Input__SvelteComponent_ = /** @type {any} */(null);
/** @typedef {InstanceType<typeof Input__SvelteComponent_>} Input__SvelteComponent_ */
export default Input__SvelteComponent_;