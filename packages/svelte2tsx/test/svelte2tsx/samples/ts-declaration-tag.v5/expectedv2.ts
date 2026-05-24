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
    const area = box.width * box.height;
    let label = $state(`${area} square pixels`);
    var doubled = area * 2;
    function format(value: number) {
        return `${value}px`;
    };

     { svelteHTML.createElement("p", {});format(doubled); label; }
}};
return { props: {} as Record<string, never>, exports: {}, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_fn_component($$render());
/*Ωignore_startΩ*/type Input__SvelteComponent_ = ReturnType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;