///<reference types="svelte" />
<></>;function render() {
/*Ωignore_startΩ*/;const __sveltets_ensureSlot = __sveltets_1_createEnsureSlot();/*Ωignore_endΩ*/                                                     {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
<><slot />                                                                                                                                            {/**
=#             Originless mappings                                                                                                                    
<><slot•/>↲    [generated] line 4                                                                                                                     
  <slot•/>↲                                                                                                                                           
<slot•/>↲      [original] line 1                                                                                                                      
------------------------------------------------------------------------------------------------------------------------------------------------------ */}

<slot name="foo">fallback</slot>
                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
<slot foo={__sveltets_ensureSlot("bar","foo",foo)} name="bar" baz={__sveltets_ensureSlot("bar","baz",baz)} leet>fallback</slot>                       {/**
<slot•foo={__sveltets_ensureSlot("bar","foo",foo)}•name="bar"•baz={__sveltets_ensureSlot("bar","baz",baz)}•leet>fallback</slot>↲    [generated] line 8
<slot•foo={                                  foo }•name="bar"•    {                                  baz }•leet>fallback</slot>↲                      
<slot•foo={foo}•name="bar"•{baz}•leet>fallback</slot>↲                                                                              [original] line 5 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}

<slot                                                                                                                                                 {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    foo={__sveltets_ensureSlot("bar","foo",foo)} name="bar"                                                                                           {/**
   ╚foo={__sveltets_ensureSlot("bar","foo",foo)}•name="bar"↲    [generated] line 11                                                                   
   ╚foo={                                  foo }•name="bar"↲                                                                                          
   ╚foo={foo}•name="bar"↲                                       [original] line 8                                                                     
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    baz={__sveltets_ensureSlot("bar","baz",baz)}                                                                                                      {/**
   ╚baz={__sveltets_ensureSlot("bar","baz",baz)}•↲    [generated] line 12                                                                             
   ╚    {                                  baz }•↲                                                                                                    
   ╚{baz}•↲                                           [original] line 9                                                                               
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    leet>fallback                                                                                                                                     {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
</slot></>                                                                                                                                            {/**
</slot></>↲    [generated] line 14                                                                                                                    
</slot>        [original] line 11                                                                                                                     
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
return { props: {}, slots: {'default': {}, 'foo': {}, 'bar': {foo:foo, baz:baz}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}