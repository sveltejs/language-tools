///<reference types="svelte" />
<></>;function render() {                                                                                                                             {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
<>{(foo) ? <>                                                                                                                                         {/**
=#                Originless mappings                                                                                                                 
<>{(foo)•?•<>↲    [generated] line 3                                                                                                                  
  { foo}     ↲                                                                                                                                        
{    foo}↲                                                                                                                                            
{#if•foo}↲        [original] line 1                                                                                                                   
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    <element />                                                                                                                                       {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
</> : <></>}                                                                                                                                          {/**
</>•:•<></>}↲    [generated] line 5                                                                                                                   
{           ↲                                                                                                                                         
{    ↲                                                                                                                                                
{/if}↲           [original] line 3                                                                                                                    
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
{((__sveltets_1_store_get(foo), $foo)) ? <><element /></> : <></>}                                                                                    {/**
{((__sveltets_1_store_get(foo),•$foo))•?•<><element•/></>•:•<></>}↲    [generated] line 7                                                             
{ $                       foo        }     <element•/>{           ↲                                                                                   
{    $foo}<element•/>{    ↲                                                                                                                           
{#if•$foo}<element•/>{/if}↲                                            [original] line 5                                                              
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
{(foo) ? <>                                                                                                                                           {/**
{(foo)•?•<>↲    [generated] line 9                                                                                                                    
{ foo}     ↲                                                                                                                                          
{    foo}↲                                                                                                                                            
{#if•foo}↲      [original] line 7                                                                                                                     
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    <element/>                                                                                                                                        {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
</> : (bar) ? <>                                                                                                                                      {/**
</>•:•(bar)•?•<>↲    [generated] line 11                                                                                                              
{      bar}     ↲                                                                                                                                     
{         bar}↲                                                                                                                                       
{:else•if•bar}↲      [original] line 9                                                                                                                
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    <element/>                                                                                                                                        {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
</> : <>                                                                                                                                              {/**
</>•:•<>↲    [generated] line 13                                                                                                                      
{       ↲                                                                                                                                             
{      ↲                                                                                                                                              
{:else}↲     [original] line 11                                                                                                                       
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    <element/>                                                                                                                                        {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
</> }</>                                                                                                                                              {/**
</>•}</>↲    [generated] line 15                                                                                                                      
{                                                                                                                                                     
{/if}        [original] line 13                                                                                                                       
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}