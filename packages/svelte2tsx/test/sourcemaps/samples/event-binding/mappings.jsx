///<reference types="svelte" />
;function render() {                                                                                                                                  {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
async () => { { const $$_tnenopmoC0C = __sveltets_2_ensureComponent(Component); const $$_tnenopmoC0 = new $$_tnenopmoC0C({ target: __sveltets_2_any(), props: {   }});$$_tnenopmoC0.$on("click", $check ? method1 : method2);}{/**
============#                                                                                                                                                                                                                      Originless mappings
async•()•=>•{•{•const•$$_tnenopmoC0C•=•__sveltets_2_ensureComponent(Component);•const•$$_tnenopmoC0•=•new•$$_tnenopmoC0C({•target:•__sveltets_2_any(),•props:•{•••}});$$_tnenopmoC0.$on("click",•$check•?•method1•:•method2);}↲    [generated] line 3
             <                                                      Component                                                                                  n{/o                     c lick = $check•?•method1•:•method2}  ↲    
                                                                                                                                                                 #                                                                 Order-breaking mappings
<Component on click={$check•?•method1•:•method2} / ↲                                                                                                                                                                               
<Component•on:click={$check•?•method1•:•method2}•/>↲                                                                                                                                                                               [original] line 1 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
  { svelteHTML.createElement("button", {  "on:click":$check ? method1 : method2,});  }};                                                              {/**
••{•svelteHTML.createElement("button",•{••"on:click":$check•?•method1•:•method2,});••}};↲    [generated] line 4                                       
<>                            button    n{c    lick =$check•?•method1•:•method2}   B/                                                                 
 #============================           #                                                   Order-breaking mappings                                  
<button  n click={$check•?•method1•:•method2} >B   /                                                                                                  
<button•on:click={$check•?•method1•:•method2}•>Bla</button>                                  [original] line 2                                        
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}