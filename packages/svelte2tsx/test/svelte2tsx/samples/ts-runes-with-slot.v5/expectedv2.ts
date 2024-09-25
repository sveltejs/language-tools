///<reference types="svelte" />
;function render<T>() {

    type Props = { a: T, b: string };
    let { a, b }: Props = $props();
    let x = $state<T>(0);
    let y = $derived(x * 2);

/*Ωignore_startΩ*/;const __sveltets_createSlot = __sveltets_2_createCreateSlot();/*Ωignore_endΩ*/;
async () => {

 { __sveltets_createSlot("default", {  x,y,});}};
return { props: {} as any as Props, exports: {}, bindings: __sveltets_$$bindings(''), slots: {'default': {x:x, y:y}}, events: {} }}
class __sveltets_Render<T> {
    props() {
        return render<T>().props;
    }
    events() {
        return render<T>().events;
    }
    slots() {
        return render<T>().slots;
    }
    bindings() { return __sveltets_$$bindings(''); }
    exports() { return {}; }
}

interface $$IsomorphicComponent {
    new <T>(options: import('svelte').ComponentConstructorOptions<ReturnType<__sveltets_Render<T>['props']>& {children?: any}>): import('svelte').SvelteComponent<ReturnType<__sveltets_Render<T>['props']>, ReturnType<__sveltets_Render<T>['events']>, ReturnType<__sveltets_Render<T>['slots']>> & { $$bindings?: ReturnType<__sveltets_Render<T>['bindings']> } & ReturnType<__sveltets_Render<T>['exports']>;
    <T>(internal: unknown, props: ReturnType<__sveltets_Render<T>['props']> & {$$slots?: ReturnType<__sveltets_Render<T>['slots']>, children?: any}): ReturnType<__sveltets_Render<T>['exports']>;
    z_$$bindings?: ReturnType<__sveltets_Render<any>['bindings']>;
}
const Input__SvelteComponent_: $$IsomorphicComponent = null as any;
/*Ωignore_startΩ*/type Input__SvelteComponent_<T> = InstanceType<typeof Input__SvelteComponent_<T>>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;