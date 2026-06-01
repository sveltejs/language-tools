///<reference types="svelte" />
;function $$render() {

    type Box = { width: number; height: number };

    let boxes: Box[] = [
        { width: 3, height: 4 },
        { width: 5, height: 7 }
    ];
;
async () => {

  for(let box of __sveltets_2_ensureArray(boxes)){
      const foo/*Ωignore_positionΩ*/ = ()/*Ωignore_startΩ*/: ReturnType<import('svelte').Snippet>/*Ωignore_endΩ*/ => { async ()/*Ωignore_positionΩ*/ => {
        const area = await 'snippet';
        area;
    };return __sveltets_2_any(0)};const area = box.width * box.height;
    let label = $state(await `${area} square pixels`);

     { svelteHTML.createElement("p", {});label; }
     { svelteHTML.createElement("div", {});
        const area = await 'nested';
        area;
     }

    
}};
return { props: /** @type {Record<string, never>} */ ({}), exports: {}, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_fn_component($$render());
/*Ωignore_startΩ*/type Input__SvelteComponent_ = ReturnType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;