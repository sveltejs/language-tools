///<reference types="svelte" />
;function $$render<T extends { a: string }>() {

	interface Props extends T {
	};
	let { a }: Props = $props();
;
async () => {};
return { props: {} as any as Props, exports: {}, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
class __sveltets_Render<T extends { a: string }> {
    props() {
        return $$render<T>().props;
    }
    events() {
        return $$render<T>().events;
    }
    slots() {
        return $$render<T>().slots;
    }
    bindings() { return __sveltets_$$bindings(''); }
    exports() { return {}; }
}

interface $$IsomorphicComponent {
    new <T extends { a: string }>(options: import('svelte').ComponentConstructorOptions<ReturnType<__sveltets_Render<T>['props']>>): import('svelte').SvelteComponent<ReturnType<__sveltets_Render<T>['props']>, ReturnType<__sveltets_Render<T>['events']>, ReturnType<__sveltets_Render<T>['slots']>> & { $$bindings?: ReturnType<__sveltets_Render<T>['bindings']> } & ReturnType<__sveltets_Render<T>['exports']>;
    <T extends { a: string }>(internal: unknown, props: ReturnType<__sveltets_Render<T>['props']> & {}): ReturnType<__sveltets_Render<T>['exports']>;
    z_$$bindings?: ReturnType<__sveltets_Render<any>['bindings']>;
}
const Input__SvelteComponent_: $$IsomorphicComponent = null as any;
/*Ωignore_startΩ*/type Input__SvelteComponent_<T extends { a: string }> = InstanceType<typeof Input__SvelteComponent_<T>>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;