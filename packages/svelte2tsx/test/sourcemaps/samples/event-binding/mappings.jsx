///<reference types="svelte" />
<></>;function render() {                                                                                                                             {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
<><Component  />{/*Ωignore_startΩ*/new Component({target: __sveltets_1_any(''), props: {}})/*Ωignore_endΩ*/.$on('click', (__sveltets_1_store_get(check), $check) ? method1 : method2)}{/**
=#                                                                                                                                                                                         Originless mappings
<><Component••/>{/*Ωignore_startΩ*/new•Component({target:•__sveltets_1_any(''),•props:•{}})/*Ωignore_endΩ*/.$on('click',•(__sveltets_1_store_get(check),•$check)•?•method1•:•method2)}↲    [generated] line 3
  <Component••/>                                                                                             on: click=  $                       check          •?•method1•:•method2} ↲    
               #=============================================================================================                                                                              Order-breaking mappings
<Component•on:click= $check•?•method1•:•method2}•/>↲                                                                                                                                       
<Component•on:click={$check•?•method1•:•method2}•/>↲                                                                                                                                       [original] line 1 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
<button onclick={(__sveltets_1_store_get(check), $check) ? method1 : method2} >Bla</button></>                                                        {/**
<button•onclick={(__sveltets_1_store_get(check),•$check)•?•method1•:•method2}•>Bla</button></>↲    [generated] line 4                                 
<button•on:    ={$                       check          •?•method1•:•method2}•>Bla</button>                                                           
<button•on:     ={$check•?•method1•:•method2}•>Bla</button>                                                                                           
<button•on:click={$check•?•method1•:•method2}•>Bla</button>                                        [original] line 2                                  
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}