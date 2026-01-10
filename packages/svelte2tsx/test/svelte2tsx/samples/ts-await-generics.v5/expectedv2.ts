///<reference types="svelte" />
;async function $$render<T>() {
;type $$ComponentProps =  { prop?: T };  const x/*Ωignore_positionΩ*/ = ()/*Ωignore_startΩ*/: ReturnType<import('svelte').Snippet>/*Ωignore_endΩ*/ => { async ()/*Ωignore_positionΩ*/ => {
    await promise;
};return __sveltets_2_any(0)};
    let { prop }:/*Ωignore_startΩ*/$$ComponentProps/*Ωignore_endΩ*/ = $props();
    const foo = await fetch('/foo');
    const promise = fetch('/bar');
;
async () => {

foo;
await promise;

  for(let item of __sveltets_2_ensureArray(await promise)){
    item;
}

   for(let item of __sveltets_2_ensureArray(await promise)){let i = 1;
    item; i;
}

    for(let item of __sveltets_2_ensureArray(await promise)){let i = 1;item.x;
    item; i;
}

 for(let $$each_item of __sveltets_2_ensureArray(await promise)){$$each_item; }

if(await promise){ } else if (await promise){ }



 { const $$_tnenopmoC0C = __sveltets_2_ensureComponent(Component); new $$_tnenopmoC0C({ target: __sveltets_2_any(), props: {  "prop":await promise,}});}
 { svelteHTML.createElement("p", { "attribute":await promise,}); }

;__sveltets_2_ensureSnippet(x(await promise));

if(true){
    const x = await promise;
    x;
}};
return { props: {} as any as $$ComponentProps, exports: {}, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
class __sveltets_Render<T> {
    props(): Awaited<ReturnType<typeof $$render<T>>>['props'] { return null as any; }
    events(): Awaited<ReturnType<typeof $$render<T>>>['events'] { return null as any; }
    slots(): Awaited<ReturnType<typeof $$render<T>>>['slots'] { return null as any; }
    bindings() { return __sveltets_$$bindings(''); }
    async exports() { return {}; }
}

interface $$IsomorphicComponent {
    new <T>(options: import('svelte').ComponentConstructorOptions<ReturnType<__sveltets_Render<T>['props']>>): import('svelte').SvelteComponent<ReturnType<__sveltets_Render<T>['props']>, ReturnType<__sveltets_Render<T>['events']>, ReturnType<__sveltets_Render<T>['slots']>> & { $$bindings?: ReturnType<__sveltets_Render<T>['bindings']> } & ReturnType<__sveltets_Render<T>['exports']>;
    <T>(internal: unknown, props: ReturnType<__sveltets_Render<T>['props']> & {}): ReturnType<__sveltets_Render<T>['exports']>;
    z_$$bindings?: ReturnType<__sveltets_Render<any>['bindings']>;
}
const Input__SvelteComponent_: $$IsomorphicComponent = null as any;
/*Ωignore_startΩ*/type Input__SvelteComponent_<T> = InstanceType<typeof Input__SvelteComponent_<T>>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;