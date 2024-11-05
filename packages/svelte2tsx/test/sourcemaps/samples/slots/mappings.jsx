///<reference types="svelte" />
;function render() {
/*Ωignore_startΩ*/;const __sveltets_createSlot = __sveltets_2_createCreateSlot();/*Ωignore_endΩ*/                                                     {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
async () => { { __sveltets_createSlot("default", {});}                                                                                                {/**
============#                                              Originless mappings                                                                        
async•()•=>•{•{•__sveltets_createSlot("default",•{});}↲    [generated] line 4                                                                         
             <                                    /   ↲                                                                                               
<     / ↲                                                                                                                                             
<slot•/>↲                                                  [original] line 1 (rest generated at line 5)                                               
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲            [generated] line 5                                                                                                                       
        ↲                                                                                                                                             
<slot•/>↲    [original] line 1 (rest generated at line 4)                                                                                             
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
 { __sveltets_createSlot("foo", { });  }                                                                                                              {/**
•{•__sveltets_createSlot("foo",•{•});••}↲    [generated] line 6                                                                                       
<                        f oo "  an  f/ ↲                                                                                                             
                              #==#           Order-breaking mappings                                                                                  
<     na    foo" f        /     ↲                                                                                                                     
<slot•name="foo">fallback</slot>↲            [original] line 3 (rest generated at line 7)                                                             
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲                                    [generated] line 7                                                                                               
                                ↲                                                                                                                     
<slot•name="foo">fallback</slot>↲    [original] line 3 (rest generated at line 6)                                                                     
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
 { __sveltets_createSlot("bar", {    "foo":foo,baz,"leet":true,});  }                                                                                 {/**
•{•__sveltets_createSlot("bar",•{••••"foo":foo,baz,"leet":true,});••}↲    [generated] line 8                                                          
<                        b ar "  {•••f oo= foo}baz}l eet          f/ ↲                                                                                
                              #==   #                                     Order-breaking mappings                                                     
<     foo={foo}•      bar"• baz}•leet f        /     ↲                                                                                                
<slot•foo={foo}•name="bar"•{baz}•leet>fallback</slot>↲                    [original] line 5 (rest generated at line 9)                                
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲                                                         [generated] line 9                                                                          
                                                     ↲                                                                                                
<slot•foo={foo}•name="bar"•{baz}•leet>fallback</slot>↲    [original] line 5 (rest generated at line 8)                                                
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
 { __sveltets_createSlot("bar", {     "foo":foo,baz,"leet":true,});                                                                                   {/**
•{•__sveltets_createSlot("bar",•{•••••"foo":foo,baz,"leet":true,});↲    [generated] line 10                                                           
•{•__sveltets_createSlot(                                               [generated] subset                                                            
<                                                                                                                                                     
<slot•↲                                                                 [original] line 7                                                             
                                                                                                                                                      
•{•__sveltets_createSlot("bar",•{•••••"foo":foo,baz,"leet":true,});↲    [generated] line 10                                                           
                         "bar",•{•••• "foo":foo,                        [generated] subset                                                            
                         b ar "  ╚{•↲ f oo= foo}                                                                                                      
                              #==   #=                                  Order-breaking mappings                                                       
╚foo={foo}•      bar"↲                                                                                                                                
╚foo={foo}•name="bar"↲                                                  [original] line 8                                                             
                                                                                                                                                      
•{•__sveltets_createSlot("bar",•{•••••"foo":foo,baz,"leet":true,});↲    [generated] line 10                                                           
                                     •          baz,                    [generated] subset                                                            
                                     •          baz}                                                                                                  
                                     #==========                        Order-breaking mappings                                                       
  baz}•                                                                                                                                               
╚{baz}•↲                                                                [original] line 9                                                             
                                                                                                                                                      
•{•__sveltets_createSlot("bar",•{•••••"foo":foo,baz,"leet":true,});↲    [generated] line 10                                                           
                                                    "leet":true,});↲    [generated] subset                                                            
                                                    l eet          f                                                                                  
 leet f                                                                                                                                               
╚leet>fallback↲                                                         [original] line 10                                                            
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
 }};                                                                                                                                                  {/**
•}};↲      [generated] line 11                                                                                                                        
/                                                                                                                                                     
 /                                                                                                                                                    
</slot>    [original] line 11                                                                                                                         
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
return { props: /** @type {Record<string, never>} */ ({}), slots: {'default': {}, 'foo': {}, 'bar': {foo:foo, baz:baz}}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}