///<reference types="svelte" />
;function render() {                                                                                                                                  {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
async () => {  for(let item of __sveltets_2_ensureArray(items)){                                                                                      {/**
============#                                                        Originless mappings                                                              
async•()•=>•{••for(let•item•of•__sveltets_2_ensureArray(items)){↲    [generated] line 3                                                               
             {a        item                             items•  ↲                                                                                     
                          #=============================             Order-breaking mappings                                                          
{      items•a  item ↲                                                                                                                                
{#each•items•as•item}↲                                               [original] line 1                                                                
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     { svelteHTML.createElement("li", {});item.name;  item.qty; }                                                                                     {/**
   ╚•{•svelteHTML.createElement("li",•{});item.name;••item.qty;•}↲    [generated] line 4                                                              
   ╚<                            li       item.name}• item.qty}/ ↲                                                                                    
   ╚<li  item.name}•   item.qty} /   ↲                                                                                                                
   ╚<li>{item.name}•x•{item.qty}</li>↲                                [original] line 2                                                               
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
}                                                                                                                                                     {/**
}↲          [generated] line 5                                                                                                                        
{↲                                                                                                                                                    
{      ↲                                                                                                                                              
{/each}↲    [original] line 3 (rest generated at line 6)                                                                                              
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲           [generated] line 6                                                                                                                        
       ↲                                                                                                                                              
{/each}↲    [original] line 3 (rest generated at line 5)                                                                                              
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
   for(let item of __sveltets_2_ensureArray(items)){let i = 1;                                                                                        {/**
•••for(let•item•of•__sveltets_2_ensureArray(items)){let•i•=•1;↲    [generated] line 7                                                                 
{a•        item,                            items•      i     ↲                                                                                       
  #========    #============================                       Order-breaking mappings                                                            
{      items•a  item,•i ↲                                                                                                                             
{#each•items•as•item,•i}↲                                          [original] line 5                                                                  
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     { svelteHTML.createElement("li", {});i + 1; item.name;  item.qty; }                                                                              {/**
   ╚•{•svelteHTML.createElement("li",•{});i•+•1;•item.name;••item.qty;•}↲    [generated] line 8                                                       
   ╚<                            li       i•+•1}:item.name}• item.qty}/ ↲                                                                             
   ╚<li  i•+•1}:  item.name}•   item.qty} /   ↲                                                                                                       
   ╚<li>{i•+•1}:•{item.name}•x•{item.qty}</li>↲                              [original] line 6                                                        
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
}                                                                                                                                                     {/**
}↲          [generated] line 9                                                                                                                        
{↲                                                                                                                                                    
{      ↲                                                                                                                                              
{/each}↲    [original] line 7 (rest generated at line 10)                                                                                             
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲           [generated] line 10                                                                                                                       
       ↲                                                                                                                                              
{/each}↲    [original] line 7 (rest generated at line 9)                                                                                              
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    for(let { id, name, qty } of __sveltets_2_ensureArray(items)){let i = 1;id;                                                                       {/**
••••for(let•{•id,•name,•qty•}•of•__sveltets_2_ensureArray(items)){let•i•=•1;id;↲    [generated] line 11                                               
{a•(        {•id,•name,•qty•},                            items•      i•    id)↲                                                                      
   #========                 #============================                          Order-breaking mappings                                           
{      items•a  {•id,•name,•qty•},•i•(id) ↲                                                                                                           
{#each•items•as•{•id,•name,•qty•},•i•(id)}↲                                         [original] line 9                                                 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     { svelteHTML.createElement("li", {});i + 1; name;  qty; }                                                                                        {/**
   ╚•{•svelteHTML.createElement("li",•{});i•+•1;•name;••qty;•}↲    [generated] line 12                                                                
   ╚<                            li       i•+•1}:name}• qty}/ ↲                                                                                       
   ╚<li  i•+•1}:  name}•   qty} /   ↲                                                                                                                 
   ╚<li>{i•+•1}:•{name}•x•{qty}</li>↲                              [original] line 10                                                                 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
}                                                                                                                                                     {/**
}↲          [generated] line 13                                                                                                                       
{↲                                                                                                                                                    
{      ↲                                                                                                                                              
{/each}↲    [original] line 11 (rest generated at line 14)                                                                                            
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲           [generated] line 14                                                                                                                       
       ↲                                                                                                                                              
{/each}↲    [original] line 11 (rest generated at line 13)                                                                                            
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
  for(let { id, ...rest } of __sveltets_2_ensureArray(objects)){                                                                                      {/**
••for(let•{•id,•...rest•}•of•__sveltets_2_ensureArray(objects)){↲    [generated] line 15                                                              
{a        {•id,•...rest•}                             objects•  ↲                                                                                     
                        #=============================               Order-breaking mappings                                                          
{      objects•a  {•id,•...rest•} ↲                                                                                                                   
{#each•objects•as•{•id,•...rest•}}↲                                  [original] line 13                                                               
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     { svelteHTML.createElement("li", {}); { svelteHTML.createElement("span", {});id; }  { const $$_tnenopmoCyM1C = __sveltets_2_ensureComponent(MyComponent); new $$_tnenopmoCyM1C({ target: __sveltets_2_any(), props: {...rest,}});} }{/**
   ╚•{•svelteHTML.createElement("li",•{});•{•svelteHTML.createElement("span",•{});id;•}••{•const•$$_tnenopmoCyM1C•=•__sveltets_2_ensureComponent(MyComponent);•new•$$_tnenopmoCyM1C({•target:•__sveltets_2_any(),•props:•{...rest,}});}•}↲    [generated] line 16
   ╚<                            li       <                            span       id}/ <>                                                        MyComponent                                                              ...rest}     / ↲    
                                                                                        #========================================================                                                                                             Order-breaking mappings
   ╚<li <span  id} /     <MyComponent  ...rest} > /   ↲                                                                                                                                                                                       
   ╚<li><span>{id}</span><MyComponent•{...rest}/></li>↲                                                                                                                                                                                       [original] line 14 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
}                                                                                                                                                     {/**
}↲          [generated] line 17                                                                                                                       
{↲                                                                                                                                                    
{      ↲                                                                                                                                              
{/each}↲    [original] line 15 (rest generated at line 18)                                                                                            
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲           [generated] line 18                                                                                                                       
       ↲                                                                                                                                              
{/each}↲    [original] line 15 (rest generated at line 17)                                                                                            
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
  for(let [id, ...rest] of __sveltets_2_ensureArray(items)){                                                                                          {/**
••for(let•[id,•...rest]•of•__sveltets_2_ensureArray(items)){↲    [generated] line 19                                                                  
{a        [id,•...rest]                             items•  ↲                                                                                         
                      #=============================             Order-breaking mappings                                                              
{      items•a  [id,•...rest] ↲                                                                                                                       
{#each•items•as•[id,•...rest]}↲                                  [original] line 17                                                                   
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     { svelteHTML.createElement("li", {}); { svelteHTML.createElement("span", {});id; }  { const $$_tnenopmoCyM1C = __sveltets_2_ensureComponent(MyComponent); new $$_tnenopmoCyM1C({ target: __sveltets_2_any(), props: { "values":rest,}});} }{/**
   ╚•{•svelteHTML.createElement("li",•{});•{•svelteHTML.createElement("span",•{});id;•}••{•const•$$_tnenopmoCyM1C•=•__sveltets_2_ensureComponent(MyComponent);•new•$$_tnenopmoCyM1C({•target:•__sveltets_2_any(),•props:•{•"values":rest,}});}•}↲    [generated] line 20
   ╚<                            li       <                            span       id}/ <>                                                        MyComponent                                                              {v alues= rest}     / ↲    
                                                                                        #========================================================                                                                         #                          Order-breaking mappings
   ╚<li <span  id} /     <MyComponent values={rest} > /   ↲                                                                                                                                                                                          
   ╚<li><span>{id}</span><MyComponent•values={rest}/></li>↲                                                                                                                                                                                          [original] line 18 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
}                                                                                                                                                     {/**
}↲          [generated] line 21                                                                                                                       
{↲                                                                                                                                                    
{      ↲                                                                                                                                              
{/each}↲    [original] line 19 (rest generated at line 22)                                                                                            
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲           [generated] line 22                                                                                                                       
       ↲                                                                                                                                              
{/each}↲    [original] line 19 (rest generated at line 21)                                                                                            
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
  for(let todo of __sveltets_2_ensureArray(todos)){                                                                                                   {/**
••for(let•todo•of•__sveltets_2_ensureArray(todos)){↲    [generated] line 23                                                                           
{a        todo                             todos•  ↲                                                                                                  
             #=============================             Order-breaking mappings                                                                       
{      todos•a  todo ↲                                                                                                                                
{#each•todos•as•todo}↲                                  [original] line 21                                                                            
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     { svelteHTML.createElement("p", {});todo.text; }                                                                                                 {/**
   ╚•{•svelteHTML.createElement("p",•{});todo.text;•}↲    [generated] line 24                                                                         
   ╚<                            p       todo.text}/ ↲                                                                                                
   ╚<p  todo.text} /  ↲                                                                                                                               
   ╚<p>{todo.text}</p>↲                                   [original] line 22                                                                          
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
}                                                                                                                                                     {/**
}↲          [generated] line 25                                                                                                                       
{↲                                                                                                                                                    
{      ↲                                                                                                                                              
{:else}↲    [original] line 23                                                                                                                        
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     { svelteHTML.createElement("p", {});   }                                                                                                         {/**
   ╚•{•svelteHTML.createElement("p",•{});•••}↲    [generated] line 26                                                                                 
   ╚<                            p       N / ↲                                                                                                        
   ╚<p N               /  ↲                                                                                                                           
   ╚<p>No•tasks•today!</p>↲                       [original] line 24                                                                                  
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
};
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}