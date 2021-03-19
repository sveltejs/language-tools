///<reference types="svelte" />
<></>;function render() {                                                                                                                             {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
<><Component  />{__sveltets_instanceOf(Component).$on('click', (__sveltets_store_get(check), $check) ? method1 : method2)}                            {/**
=#                                                                                                                         	Originless mappings       
<><Component••/>{__sveltets_instanceOf(Component).$on('click',•(__sveltets_store_get(check),•$check)•?•method1•:•method2)}↲	[generated] line 3        
  <Component••/>                                   on: click=  $                     check          •?•method1•:•method2} ↲	                          
               #===================================                                                                        	Order-breaking mappings   
<Component•on:click= $check•?•method1•:•method2}•/>↲                                                                       	                          
<Component•on:click={$check•?•method1•:•method2}•/>↲                                                                       	[original] line 1         
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
<button onclick={(__sveltets_store_get(check), $check) ? method1 : method2} >Bla</button></>                                                          {/**
<button•onclick={(__sveltets_store_get(check),•$check)•?•method1•:•method2}•>Bla</button></>↲	[generated] line 4                                      
<button•on:    ={$                     check          •?•method1•:•method2}•>Bla</button>    	                                                        
<button•on:     ={$check•?•method1•:•method2}•>Bla</button>                                  	                                                        
<button•on:click={$check•?•method1•:•method2}•>Bla</button>                                  	[original] line 2                                       
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}