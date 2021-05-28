///<reference types="svelte" />
//----------------------------------------------------------------------------------------------------------------------------------------------------
<></>;function render() {                                                                                                                             {/**
=#                            Originless mappings                                                                                                     
<></>;function•render()•{↲    [generated] line 2                                                                                                      
  <   s                                                                                                                                               
<s                                                                                                                                                    
<script>↲                     [original] line 1 (rest generated at line 3)                                                                            
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲            [generated] line 3                                                                                                                       
        ↲                                                                                                                                             
<script>↲    [original] line 1 (rest generated at line 2)                                                                                             
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     let prop/*Ωignore_startΩ*/;let $prop = __sveltets_store_get(prop);/*Ωignore_endΩ*/                                                               {/**
   ╚•let•prop/*Ωignore_startΩ*/;let•$prop•=•__sveltets_store_get(prop);/*Ωignore_endΩ*/↲    [generated] line 4                                        
   ╚•let•prop                                                                          ↲                                                              
   ╚      •let•prop↲                                                                                                                                  
   ╚export•let•prop↲                                                                        [original] line 2                                         
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    let  foo = __sveltets_invalidate(() => prop);                                                                                                     {/**
   ╚let••foo•=•__sveltets_invalidate(()•=>•prop);↲    [generated] line 5                                                                              
   ╚    •foo•=•                            prop ;↲                                                                                                    
   ╚  •foo•=•prop;↲                                                                                                                                   
   ╚$:•foo•=•prop;↲                                   [original] line 3                                                                               
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    let  bar = __sveltets_invalidate(() => (__sveltets_store_get(prop), $prop));                                                                      {/**
   ╚let••bar•=•__sveltets_invalidate(()•=>•(__sveltets_store_get(prop),•$prop));↲    [generated] line 6                                               
   ╚    •bar•=•                            $                     prop          ;↲                                                                     
   ╚  •bar•=•$prop;↲                                                                                                                                  
   ╚$:•bar•=•$prop;↲                                                                 [original] line 4                                                
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    ;() => {$: if (bar) ++foo}                                                                                                                        {/**
   ╚;()•=>•{$:•if•(bar)•++foo}↲    [generated] line 7                                                                                                 
   ╚        $:•if•(bar)•++foo ↲                                                                                                                       
   ╚$:•if•(bar)•++foo↲             [original] line 5                                                                                                  
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    ;() => {$: { if (foo) bar(); }}                                                                                                                   {/**
   ╚;()•=>•{$:•{•if•(foo)•bar();•}}↲    [generated] line 8                                                                                            
   ╚        $:•{•if•(foo)•bar();•} ↲                                                                                                                  
   ╚$:•{•if•(foo)•bar();•}↲             [original] line 6                                                                                             
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
;                                                                                                                                                     {/**
;↲           [generated] line 9                                                                                                                       
<                                                                                                                                                     
</script>    [original] line 7                                                                                                                        
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
() => (<></>);
return { props: {prop: prop}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render()))) {
}