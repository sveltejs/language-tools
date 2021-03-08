///<reference types="svelte" />
<></>;                                                                                                                                   {/** 
---------------------------------------------------------------# Line 2 #----------------------------------------------------------------
		☼☼        	Originless characters
		<></>;↲   	[generated] line 2
		  <       	
		<         	
		<script>↲ 	[original] line 1 (rest generated at lines 4, 5)
----------------------------------------------------------------------------------------------------------------------------------------- */} 
import Component from "foo";                                                                                                             {/** 
---------------------------------------------------------------# Line 3 #----------------------------------------------------------------
		import•Component•from•"foo";↲  	[generated] line 3
		import•Component•from•"foo";   	
		 import•Component•from•"foo";  	
		╚import•Component•from•"foo";↲ 	[original] line 2 (rest generated at line 6)
----------------------------------------------------------------------------------------------------------------------------------------- */} 
function render() {                                                                                                                      {/** 
---------------------------------------------------------------# Line 4 #----------------------------------------------------------------
		function•render()•{↲ 	[generated] line 4
		s                    	
		 s                   	
		<script>↲            	[original] line 1 (rest generated at lines 2, 5)
----------------------------------------------------------------------------------------------------------------------------------------- */} 
                                                                                                                                         {/** 
---------------------------------------------------------------# Line 5 #----------------------------------------------------------------
		↲         	[generated] line 5
		        ↲ 	
		<script>↲ 	[original] line 1 (rest generated at lines 2, 4)
----------------------------------------------------------------------------------------------------------------------------------------- */} 
                                                                                                                                         {/** 
---------------------------------------------------------------# Line 6 #----------------------------------------------------------------
		╚↲                             	[generated] line 6
		╚                            ↲ 	
		╚import•Component•from•"foo";↲ 	[original] line 2 (rest generated at line 3)
----------------------------------------------------------------------------------------------------------------------------------------- */} 

    const { check, method1, method2 } = Component;let $check = __sveltets_store_get(check);;                                             {/** 
---------------------------------------------------------------# Line 8 #----------------------------------------------------------------
		╚const•{•check,•method1,•method2•}•=•Component;let•$check•=•__sveltets_store_get(check);;↲ 	[generated] line 8
		╚const•{•check,•method1,•method2•}•=•Component                                          ;↲ 	
		╚const•{•check,•method1,•method2•}•=•Component;↲                                           	[original] line 4
----------------------------------------------------------------------------------------------------------------------------------------- */} 
;                                                                                                                                        {/** 
---------------------------------------------------------------# Line 9 #----------------------------------------------------------------
		;↲         	[generated] line 9
		<          	
		</script>↲ 	[original] line 5 (rest generated at line 10)
----------------------------------------------------------------------------------------------------------------------------------------- */} 
() => (<>                                                                                                                                {/** 
---------------------------------------------------------------# Line 10 #---------------------------------------------------------------
		☼☼☼☼☼☼☼☼☼  	Originless characters
		()•=>•(<>↲ 	[generated] line 10
		         ↲ 	
		</script>↲ 	[original] line 5 (rest generated at line 9)
----------------------------------------------------------------------------------------------------------------------------------------- */} 
<Component  />{__sveltets_instanceOf(Component).$on('click', (__sveltets_store_get(check), $check) ? method1 : method2)}                 {/** 
---------------------------------------------------------------# Line 11 #---------------------------------------------------------------
		<Component••/>{__sveltets_instanceOf(Component).$on('click',•(__sveltets_store_get(check),•$check)•?•method1•:•method2)}↲ 	[generated] line 11
		<Component••/>                                   on: click=  $                     check          •?•method1•:•method2} ↲ 	
		             #===================================                                                                         	Order-breaking mappings
		<Component•on:click= $check•?•method1•:•method2}•/>↲                                                                      	
		<Component•on:click={$check•?•method1•:•method2}•/>↲                                                                      	[original] line 6
----------------------------------------------------------------------------------------------------------------------------------------- */} 
<button onclick={(__sveltets_store_get(check), $check) ? method1 : method2} >Bla</button></>);                                           {/** 
---------------------------------------------------------------# Line 12 #---------------------------------------------------------------
		<button•onclick={(__sveltets_store_get(check),•$check)•?•method1•:•method2}•>Bla</button></>);↲ 	[generated] line 12
		<button•on:    ={$                     check          •?•method1•:•method2}•>Bla</button>       	
		<button•on:     ={$check•?•method1•:•method2}•>Bla</button>                                     	
		<button•on:click={$check•?•method1•:•method2}•>Bla</button>                                     	[original] line 7
----------------------------------------------------------------------------------------------------------------------------------------- */} 
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}
