///<reference types="svelte" />
//----------------------------------------------------------------------------------------------------------------------------------------------------
;function render() { let $$props = __sveltets_1_allPropsType(); let $$restProps = __sveltets_1_restPropsType(); let $$slots = __sveltets_1_slotsType({});{/**
;function•render()•{•let•$$props•=•__sveltets_1_allPropsType();•let•$$restProps•=•__sveltets_1_restPropsType();•let•$$slots•=•__sveltets_1_slotsType({});↲    [generated] line 2
<s                                                                                                                                                            
<script>↲                                                                                                                                                     [original] line 1 (rest generated at line 3)
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲            [generated] line 3                                                                                                                       
        ↲                                                                                                                                             
<script>↲    [original] line 1 (rest generated at line 2)                                                                                             
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    $$slots;
    $$restProps;
    $$props;                                                                                                                                          {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    let  foo = __sveltets_1_invalidate(() => ({...$$slots, ...$$restProps, ...$$props}));                                                             {/**
   ╚let••foo•=•__sveltets_1_invalidate(()•=>•({...$$slots,•...$$restProps,•...$$props}));↲    [generated] line 7                                      
   ╚    •foo•=•                               {...$$slots,•...$$restProps,•...$$props} ; ↲                                                            
   ╚  •foo•=•{...$$slots,•...$$restProps,•...$$props};↲                                                                                               
   ╚$:•foo•=•{...$$slots,•...$$restProps,•...$$props};↲                                       [original] line 5                                       
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
;                                                                                                                                                     {/**
;↲            [generated] line 8                                                                                                                      
<                                                                                                                                                     
</script>↲    [original] line 6 (rest generated at line 9)                                                                                            
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
async () => {                                                                                                                                         {/**
============#     Originless mappings                                                                                                                 
async•()•=>•{↲    [generated] line 9                                                                                                                  
             ↲                                                                                                                                        
         ↲                                                                                                                                            
</script>↲        [original] line 6 (rest generated at line 8)                                                                                        
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**

------------------------------------------------------------------------------------------------------------------------------------------------------ */}
if($$slots.foo){                                                                                                                                      {/**
if($$slots.foo){↲     [generated] line 11                                                                                                             
{  $$slots.foo} ↲                                                                                                                                     
{    $$slots.foo}↲                                                                                                                                    
{#if•$$slots.foo}↲    [original] line 8                                                                                                               
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    $$restProps.bar;                                                                                                                                  {/**
   ╚$$restProps.bar;↲     [generated] line 12                                                                                                         
   ╚$$restProps.bar}↲                                                                                                                                 
   ╚ $$restProps.bar}↲                                                                                                                                
   ╚{$$restProps.bar}↲    [original] line 9                                                                                                           
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     { const $$_tnenopmoC0C = __sveltets_2_ensureComponent(Component); new $$_tnenopmoC0C({ target: __sveltets_2_any(), props: {  ...$$props,}});}    {/**
   #                                                                                                                                                   Originless mappings
   ╚•{•const•$$_tnenopmoC0C•=•__sveltets_2_ensureComponent(Component);•new•$$_tnenopmoC0C({•target:•__sveltets_2_any(),•props:•{••...$$props,}});}↲    [generated] line 13
                                                                                                                                • ...$$props,}});}     [generated] subset
                                                                                                                                ╚ ...$$props}          
   ╚  ...$$props}                                                                                                                                      
   ╚╚{...$$props}↲                                                                                                                                     [original] line 11 
                                                                                                                                                       
   ╚•{•const•$$_tnenopmoC0C•=•__sveltets_2_ensureComponent(Component);•new•$$_tnenopmoC0C({•target:•__sveltets_2_any(),•props:•{••...$$props,}});}↲    [generated] line 13
                                                                                                                                 •                ↲    [generated] subset
                                                                                                                                 ╚                ↲    
   ╚  ↲                                                                                                                                                
   ╚/>↲                                                                                                                                                [original] line 12 
                                                                                                                                                       
   ╚•{•const•$$_tnenopmoC0C•=•__sveltets_2_ensureComponent(Component);•new•$$_tnenopmoC0C({•target:•__sveltets_2_any(),•props:•{••...$$props,}});}↲    [generated] line 13
    •{•const•$$_tnenopmoC0C•=•__sveltets_2_ensureComponent(Component);•new•$$_tnenopmoC0C({•target:•__sveltets_2_any(),•props:•{                       [generated] subset
    <                                                      Component                                                                                   
    <Component                                                                                                                                         
   ╚<Component•↲                                                                                                                                       [original] line 10 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
}};                                                                                                                                                   {/**
}};↲     [generated] line 14                                                                                                                          
{                                                                                                                                                     
{/if}    [original] line 13                                                                                                                           
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
return { props: {}, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial_with_any(__sveltets_1_with_any_event(render()))) {
}