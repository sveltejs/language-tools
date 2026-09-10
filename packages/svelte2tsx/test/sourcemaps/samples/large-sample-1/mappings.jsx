///<reference types="svelte" />
//----------------------------------------------------------------------------------------------------------------------------------------------------
;                                                                                                                                                     {/**
;↲                            [generated] line 2                                                                                                      
<↲                                                                                                                                                    
<                        ↲                                                                                                                            
<script•context="module">↲    [original] line 1                                                                                                       
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    export async function preload({ params }) {
        const res = await this.fetch(`tutorial/${params.slug}.json`);

        if (!res.ok) {
            return this.redirect(301, `tutorial/basics`);
        }

        return {
            slug: params.slug,
            chapter: await res.json()
        };
    }                                                                                                                                                 {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
;;                                                                                                                                                    {/**
;;↲           [generated] line 15                                                                                                                     
;             [generated] subset                                                                                                                      
<                                                                                                                                                     
</script>↲    [original] line 14 (rest generated at lines 112, 113)                                                                                   
                                                                                                                                                      
;;↲           [generated] line 15                                                                                                                     
 ;↲           [generated] subset                                                                                                                      
 <                                                                                                                                                    
<                                                                                                                                                     
<script>↲     [original] line 16 (rest generated at lines 28, 29)                                                                                     
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**

------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    import Repl from '@sveltejs/svelte-repl';
    import { getContext } from 'svelte';

    import ScreenToggle from '../../../components/ScreenToggle.svelte';
    import TableOfContents from './_TableOfContents.svelte';

    import {
        mapbox_setup, // needed for context API tutorial
        rollupUrl,
        svelteUrl
    } from '../../../config';                                                                                                                         {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
function $$render() {                                                                                                                                 {/**
function•$$render()•{↲    [generated] line 28                                                                                                         
s                                                                                                                                                     
 s                                                                                                                                                    
<script>↲                 [original] line 16 (rest generated at lines 15, 29)                                                                         
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲            [generated] line 29                                                                                                                      
        ↲                                                                                                                                             
<script>↲    [original] line 16 (rest generated at lines 15, 28)                                                                                      
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     let slug/*Ωignore_startΩ*/;slug = __sveltets_2_any(slug);/*Ωignore_endΩ*/;                                                                       {/**
   ╚•let•slug/*Ωignore_startΩ*/;slug•=•__sveltets_2_any(slug);/*Ωignore_endΩ*/;↲    [generated] line 31                                               
   ╚•let•slug;                                                                 ↲                                                                      
   ╚      •let•slug;↲                                                                                                                                 
   ╚export•let•slug;↲                                                               [original] line 29                                                
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     let chapter/*Ωignore_startΩ*/;chapter = __sveltets_2_any(chapter);/*Ωignore_endΩ*/;                                                              {/**
   ╚•let•chapter/*Ωignore_startΩ*/;chapter•=•__sveltets_2_any(chapter);/*Ωignore_endΩ*/;↲    [generated] line 32                                      
   ╚•let•chapter;                                                                       ↲                                                             
   ╚      •let•chapter;↲                                                                                                                              
   ╚export•let•chapter;↲                                                                     [original] line 30                                       
------------------------------------------------------------------------------------------------------------------------------------------------------ */}

    const { sections } = getContext('tutorial');

    let repl;
    let prev;
    let scrollable;
    const lookup = new Map();

    let width = process.browser ? window.innerWidth : 1000;
    let offset = 0;

    sections.forEach(section => {
        section.chapters.forEach(chapter => {
            const obj = {
                slug: chapter.slug,
                section,
                chapter,
                prev
            };

            lookup.set(chapter.slug, obj);

            if (process.browser) { // pending https://github.com/sveltejs/svelte/issues/2135
                if (prev) prev.next = obj;
                prev = obj;
            }
        });
    });

    // TODO is there a non-hacky way to trigger scroll when chapter changes?
//----------------------------------------------------------------------------------------------------------------------------------------------------
    ;() => {$: if (scrollable) chapter, scrollable.scrollTo(0, 0);}                                                                                   {/**
   ╚;()•=>•{$:•if•(scrollable)•chapter,•scrollable.scrollTo(0,•0);}↲    [generated] line 63                                                           
   ╚        $:•if•(scrollable)•chapter,•scrollable.scrollTo(0,•0);↲                                                                                   
   ╚$:•if•(scrollable)•chapter,•scrollable.scrollTo(0,•0);↲             [original] line 61                                                            
------------------------------------------------------------------------------------------------------------------------------------------------------ */}

    // TODO: this will need to be changed to the master branch, and probably should be dynamic instead of included
    //   here statically
    const tutorial_repo_link = 'https://github.com/sveltejs/svelte/tree/master/site/content/tutorial';
                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    let  selected = __sveltets_2_invalidate(() => lookup.get(slug));                                                                                  {/**
   ╚let••selected•=•__sveltets_2_invalidate(()•=>•lookup.get(slug));↲    [generated] line 69                                                          
   ╚    •selected•=•                              lookup.get(slug); ↲                                                                                 
   ╚  •selected•=•lookup.get(slug);↲                                                                                                                  
   ╚$:•selected•=•lookup.get(slug);↲                                     [original] line 67                                                           
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    let  improve_link = __sveltets_2_invalidate(() => `${tutorial_repo_link}/${selected.chapter.section_dir}/${selected.chapter.chapter_dir}`);       {/**
   ╚let••improve_link•=•__sveltets_2_invalidate(()•=>•`${tutorial_repo_link}/${selected.chapter.section_dir}/${selected.chapter.chapter_dir}`);↲    [generated] line 70
   ╚    •improve_link•=•                              `${tutorial_repo_link}/${selected.chapter.section_dir}/${selected.chapter.chapter_dir}`; ↲      
   ╚  •improve_link•=•`${tutorial_repo_link}/${selected.chapter.section_dir}/${selected.chapter.chapter_dir}`;↲                                       
   ╚$:•improve_link•=•`${tutorial_repo_link}/${selected.chapter.section_dir}/${selected.chapter.chapter_dir}`;↲                                     [original] line 68 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}

    const clone = file => ({
        name: file.name,
        type: file.type,
        source: file.source
    });
                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    ;() => {$: if (repl) {                                                                                                                            {/**
   ╚;()•=>•{$:•if•(repl)•{↲    [generated] line 78                                                                                                    
   ╚        $:•if•(repl)•{↲                                                                                                                           
   ╚$:•if•(repl)•{↲            [original] line 76                                                                                                     
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
        completed = false;
        repl.set({
            components: chapter.app_a.map(clone)
        });                                                                                                                                           {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    }}                                                                                                                                                {/**
   ╚}}↲    [generated] line 83                                                                                                                        
   ╚}↲     [original] line 81                                                                                                                         
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    let  mobile = __sveltets_2_invalidate(() => width < 768);                                                                                         {/**
   ╚let••mobile•=•__sveltets_2_invalidate(()•=>•width•<•768);↲    [generated] line 85                                                                 
   ╚    •mobile•=•                              width•<•768; ↲                                                                                        
   ╚  •mobile•=•width•<•768;↲                                                                                                                         
   ╚$:•mobile•=•width•<•768;↲                                     [original] line 83                                                                  
------------------------------------------------------------------------------------------------------------------------------------------------------ */}

    function reset() {
        repl.update({
            components: chapter.app_a.map(clone)
        });
    }

    function complete() {
        repl.update({
            components: chapter.app_b.map(clone)
        });
    }

    let completed = false;

    function handle_change(event) {
        completed = event.detail.components.every((file, i) => {
            const expected = chapter.app_b[i];
            return expected && (
                file.name === expected.name &&
                file.type === expected.type &&
                file.source.trim().replace(/\s+$/gm, '') === expected.source.trim().replace(/\s+$/gm, '')
            );
        });
    }                                                                                                                                                 {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
;                                                                                                                                                     {/**
;↲            [generated] line 111                                                                                                                    
<                                                                                                                                                     
</script>↲    [original] line 109 (rest generated at lines 112, 114, 115)                                                                             
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
async () => {                                                                                                                                         {/**
async•()•=>•{↲    [generated] line 112                                                                                                                
async•()•=>•{     [generated] subset                                                                                                                  
<                                                                                                                                                     
</script>↲        [original] line 109 (rest generated at lines 111, 114, 115)                                                                         
                                                                                                                                                      
async•()•=>•{↲    [generated] line 112                                                                                                                
             ↲    [generated] subset                                                                                                                  
         ↲                                                                                                                                            
</script>↲        [original] line 14 (rest generated at lines 15, 113)                                                                                
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲             [generated] line 113                                                                                                                    
         ↲                                                                                                                                            
</script>↲    [original] line 14 (rest generated at lines 15, 112)                                                                                    
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲             [generated] line 114                                                                                                                    
         ↲                                                                                                                                            
</script>↲    [original] line 109 (rest generated at lines 111, 112, 115)                                                                             
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲             [generated] line 115                                                                                                                    
         ↲                                                                                                                                            
</script>↲    [original] line 109 (rest generated at lines 111, 112, 114)                                                                             
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲            [generated] line 116                                                                                                                     
        ↲                                                                                                                                             
</style>↲    [original] line 259 (rest generated at line 117)                                                                                         
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲            [generated] line 117                                                                                                                     
        ↲                                                                                                                                             
</style>↲    [original] line 259 (rest generated at line 116)                                                                                         
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
 { svelteHTML.createElement("svelte:head", {});                                                                                                       {/**
•{•svelteHTML.createElement("svelte:head",•{});↲    [generated] line 118                                                                              
s                                              ↲                                                                                                      
 s           ↲                                                                                                                                        
<svelte:head>↲                                      [original] line 261 (rest generated at line 119)                                                  
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     { svelteHTML.createElement("title", {});selected.section.title;  selected.chapter.title;    }                                                    {/**
   ╚•{•svelteHTML.createElement("title",•{});selected.section.title;••selected.chapter.title;••••}↲    [generated] line 119                           
   ╚                                                                                                   [generated] subset                             
   ↲                                                                                                                                                  
                ↲                                                                                                                                     
   <svelte:head>↲                                                                                      [original] line 261 (rest generated at line 118)
                                                                                                                                                      
   ╚•{•svelteHTML.createElement("title",•{});selected.section.title;••selected.chapter.title;••••}↲    [generated] line 119                           
    •{•svelteHTML.createElement("title",•{});selected.section.title;••selected.chapter.title;••••}↲    [generated] subset                             
    <                            title       selected.section.title}• selected.chapter.title}•  / ↲                                                   
    <title  selected.section.title}•   selected.chapter.title}•                  /      ↲                                                             
   ╚<title>{selected.section.title}•/•{selected.chapter.title}•••Svelte•Tutorial</title>↲              [original] line 262 (rest generated at lines 120, 121)
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲                                                                                         [generated] line 120                                        
                                                                                     ↲                                                                
╚<title>{selected.section.title}•/•{selected.chapter.title}•••Svelte•Tutorial</title>↲    [original] line 262 (rest generated at lines 119, 121)      
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     { svelteHTML.createElement("meta", {   "name":`twitter:title`,"content":`Svelte tutorial`,});}                                                   {/**
   ╚•{•svelteHTML.createElement("meta",•{•••"name":`twitter:title`,"content":`Svelte•tutorial`,});}↲    [generated] line 121                          
   ╚                                                                                                    [generated] subset                            
   ↲                                                                                                                                                  
                                                                                        ↲                                                             
   ╚<title>{selected.section.title}•/•{selected.chapter.title}•••Svelte•Tutorial</title>↲               [original] line 262 (rest generated at lines 119, 120)
                                                                                                                                                      
   ╚•{•svelteHTML.createElement("meta",•{•••"name":`twitter:title`,"content":`Svelte•tutorial`,});}↲    [generated] line 121                          
    •{•svelteHTML.createElement("meta",•{•••"name":`twitter:title`,"content":`Svelte•tutorial`,});}↲    [generated] subset                            
    <                            meta    "•"n ame=  twitter:title" c ontent=  Svelte•tutorial"     ↲                                                  
                                           #                                                            Order-breaking mappings                       
    <meta name="twitter:title"•content="Svelte•tutorial" ↲                                                                                            
   ╚<meta•name="twitter:title"•content="Svelte•tutorial">↲                                              [original] line 264 (rest generated at line 122)
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     { svelteHTML.createElement("meta", {   "name":`twitter:description`,"content":`${selected.section.title} / ${selected.chapter.title}`,});}       {/**
   ╚•{•svelteHTML.createElement("meta",•{•••"name":`twitter:description`,"content":`${selected.section.title}•/•${selected.chapter.title}`,});}↲    [generated] line 122
   ╚                                                                                                                                                [generated] subset
   ↲                                                                                                                                                  
                                                         ↲                                                                                            
   ╚<meta•name="twitter:title"•content="Svelte•tutorial">↲                                                                                          [original] line 264 (rest generated at line 121)
                                                                                                                                                      
   ╚•{•svelteHTML.createElement("meta",•{•••"name":`twitter:description`,"content":`${selected.section.title}•/•${selected.chapter.title}`,});}↲    [generated] line 122
    •{•svelteHTML.createElement("meta",•{•••"name":`twitter:description`,"content":`${selected.section.title}•/•${selected.chapter.title}`,});}↲    [generated] subset
    <                            meta    "•"n ame=  twitter:description" c ontent=   {selected.section.title}•/• {selected.chapter.title}"     ↲      
                                           #                                                                                                        Order-breaking mappings
    <meta name="twitter:description"•content="{selected.section.title}•/•{selected.chapter.title}" ↲                                                  
   ╚<meta•name="twitter:description"•content="{selected.section.title}•/•{selected.chapter.title}">↲                                                [original] line 265 (rest generated at line 123)
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     { svelteHTML.createElement("meta", {   "name":`Description`,"content":`${selected.section.title} / ${selected.chapter.title}`,});}               {/**
   ╚•{•svelteHTML.createElement("meta",•{•••"name":`Description`,"content":`${selected.section.title}•/•${selected.chapter.title}`,});}↲    [generated] line 123
   ╚                                                                                                                                        [generated] subset
   ↲                                                                                                                                                  
                                                                                                   ↲                                                  
   ╚<meta•name="twitter:description"•content="{selected.section.title}•/•{selected.chapter.title}">↲                                        [original] line 265 (rest generated at line 122)
                                                                                                                                                      
   ╚•{•svelteHTML.createElement("meta",•{•••"name":`Description`,"content":`${selected.section.title}•/•${selected.chapter.title}`,});}↲    [generated] line 123
    •{•svelteHTML.createElement("meta",•{•••"name":`Description`,"content":`${selected.section.title}•/•${selected.chapter.title}`,});}↲    [generated] subset
    <                            meta    "•"n ame=  Description" c ontent=   {selected.section.title}•/• {selected.chapter.title}"     ↲              
                                           #                                                                                                Order-breaking mappings
    <meta name="Description"•content="{selected.section.title}•/•{selected.chapter.title}" ↲                                                          
   ╚<meta•name="Description"•content="{selected.section.title}•/•{selected.chapter.title}">↲                                                [original] line 266 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
 }                                                                                                                                                    {/**
•}↲                [generated] line 124                                                                                                               
/ ↲                                                                                                                                                   
 /            ↲                                                                                                                                       
</svelte:head>↲    [original] line 267 (rest generated at line 125)                                                                                   
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲                  [generated] line 125                                                                                                               
              ↲                                                                                                                                       
</svelte:head>↲    [original] line 267 (rest generated at line 124)                                                                                   
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
  { svelteHTML.createElement("svelte:window", { "bind:innerWidth":width,});/*Ωignore_startΩ*/() => width = __sveltets_2_any(null);/*Ωignore_endΩ*/}   {/**
••{•svelteHTML.createElement("svelte:window",•{•"bind:innerWidth":width,});/*Ωignore_startΩ*/()•=>•width•=•__sveltets_2_any(null);/*Ωignore_endΩ*/}↲    [generated] line 126
<>                                             { bind:innerWidth= width}                                                                           ↲    
 #=============================================#=                                                                                                       Order-breaking mappings
<              bind:innerWidth={width} >↲                                                                                                               
<svelte:window•bind:innerWidth={width}/>↲                                                                                                               [original] line 269 (rest generated at line 127)
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲                                            [generated] line 127                                                                                     
                                        ↲                                                                                                             
<svelte:window•bind:innerWidth={width}/>↲    [original] line 269 (rest generated at line 126)                                                         
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
 { svelteHTML.createElement("div", { "class":`tutorial-outer`,});                                                                                     {/**
•{•svelteHTML.createElement("div",•{•"class":`tutorial-outer`,});↲    [generated] line 128                                                            
<                            div    "c lass=  tutorial-outer"    ↲                                                                                    
                                    #                                 Order-breaking mappings                                                         
<div class="tutorial-outer" ↲                                                                                                                         
<div•class="tutorial-outer">↲                                         [original] line 271 (rest generated at line 129)                                
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     { svelteHTML.createElement("div", { "class":`viewport offset-${offset}`,});                                                                      {/**
   ╚•{•svelteHTML.createElement("div",•{•"class":`viewport•offset-${offset}`,});↲    [generated] line 129                                             
   ╚                                                                                 [generated] subset                                               
   ↲                                                                                                                                                  
                               ↲                                                                                                                      
   <div•class="tutorial-outer">↲                                                     [original] line 271 (rest generated at line 128)                 
                                                                                                                                                      
   ╚•{•svelteHTML.createElement("div",•{•"class":`viewport•offset-${offset}`,});↲    [generated] line 129                                             
    •{•svelteHTML.createElement("div",•{•"class":`viewport•offset-${offset}`,});↲    [generated] subset                                               
    <                            div    "c lass=  viewport•offset- {offset}"    ↲                                                                     
                                        #                                            Order-breaking mappings                                          
    <div class="viewport•offset-{offset}" ↲                                                                                                           
   ╚<div•class="viewport•offset-{offset}">↲                                          [original] line 272 (rest generated at line 130)                 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
         { svelteHTML.createElement("div", { "class":`tutorial-text`,});                                                                              {/**
      ╚╚•{•svelteHTML.createElement("div",•{•"class":`tutorial-text`,});↲    [generated] line 130                                                     
      ╚╚                                                                     [generated] subset                                                       
      ↲                                                                                                                                               
                                             ↲                                                                                                        
      ╚<div•class="viewport•offset-{offset}">↲                               [original] line 272 (rest generated at line 129)                         
                                                                                                                                                      
      ╚╚•{•svelteHTML.createElement("div",•{•"class":`tutorial-text`,});↲    [generated] line 130                                                     
        •{•svelteHTML.createElement("div",•{•"class":`tutorial-text`,});↲    [generated] subset                                                       
        <                            div    "c lass=  tutorial-text"    ↲                                                                             
                                            #                                Order-breaking mappings                                                  
        <div class="tutorial-text" ↲                                                                                                                  
      ╚╚<div•class="tutorial-text">↲                                         [original] line 273 (rest generated at line 131)                         
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
             { svelteHTML.createElement("div", { "class":`table-of-contents`,});                                                                      {/**
         ╚╚╚•{•svelteHTML.createElement("div",•{•"class":`table-of-contents`,});↲    [generated] line 131                                             
         ╚╚╚                                                                         [generated] subset                                               
         ↲                                                                                                                                            
                                      ↲                                                                                                               
         ╚╚<div•class="tutorial-text">↲                                              [original] line 273 (rest generated at line 130)                 
                                                                                                                                                      
         ╚╚╚•{•svelteHTML.createElement("div",•{•"class":`table-of-contents`,});↲    [generated] line 131                                             
            •{•svelteHTML.createElement("div",•{•"class":`table-of-contents`,});↲    [generated] subset                                               
            <                            div    "c lass=  table-of-contents"    ↲                                                                     
                                                #                                    Order-breaking mappings                                          
            <div class="table-of-contents" ↲                                                                                                          
         ╚╚╚<div•class="table-of-contents">↲                                         [original] line 274 (rest generated at line 132)                 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                  { const $$_stnetnoCfOelbaT4C = __sveltets_2_ensureComponent(TableOfContents); new $$_stnetnoCfOelbaT4C({ target: __sveltets_2_any(), props: {  sections,slug,selected,}});}{/**
            ╚╚╚╚••{•const•$$_stnetnoCfOelbaT4C•=•__sveltets_2_ensureComponent(TableOfContents);•new•$$_stnetnoCfOelbaT4C({•target:•__sveltets_2_any(),•props:•{••sections,slug,selected,}});}↲    [generated] line 132
            ╚╚╚╚                                                                                                                                                                                  [generated] subset
            ↲                                                                                                                                                                                     
                                              ↲                                                                                                                                                   
            ╚╚╚<div•class="table-of-contents">↲                                                                                                                                                   [original] line 274 (rest generated at line 131)
                                                                                                                                                                                                  
            ╚╚╚╚••{•const•$$_stnetnoCfOelbaT4C•=•__sveltets_2_ensureComponent(TableOfContents);•new•$$_stnetnoCfOelbaT4C({•target:•__sveltets_2_any(),•props:•{••sections,slug,selected,}});}↲    [generated] line 132
                ••{•const•$$_stnetnoCfOelbaT4C•=•__sveltets_2_ensureComponent(TableOfContents);•new•$$_stnetnoCfOelbaT4C({•target:•__sveltets_2_any(),•props:•{••sections,slug,selected,}});}↲    [generated] subset
                <>                                                            TableOfContents                                                                  ••sections}slug}selected}     ↲    
                 #============================================================                                                                                  #                                 Order-breaking mappings
                <TableOfContents  sections}• slug}• selected} >↲                                                                                                                                  
            ╚╚╚╚<TableOfContents•{sections}•{slug}•{selected}/>↲                                                                                                                                  [original] line 275 (rest generated at line 133)
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
             }                                                                                                                                        {/**
         ╚╚╚•}↲                                                  [generated] line 133                                                                 
         ╚╚╚                                                     [generated] subset                                                                   
         ↲                                                                                                                                            
                                                            ↲                                                                                         
         ╚╚╚╚<TableOfContents•{sections}•{slug}•{selected}/>↲    [original] line 275 (rest generated at line 132)                                     
                                                                                                                                                      
         ╚╚╚•}↲                                                  [generated] line 133                                                                 
            •}↲                                                  [generated] subset                                                                   
            / ↲                                                                                                                                       
             /    ↲                                                                                                                                   
         ╚╚╚</div>↲                                              [original] line 276 (rest generated at lines 134, 135)                               
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲             [generated] line 134                                                                                                                    
         ↲                                                                                                                                            
╚╚╚</div>↲    [original] line 276 (rest generated at lines 133, 135)                                                                                  
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
             { const $$_div3 = svelteHTML.createElement("div", {  "class":`chapter-markup`,});scrollable = $$_div3;                                   {/**
         ╚╚╚•{•const•$$_div3•=•svelteHTML.createElement("div",•{••"class":`chapter-markup`,});scrollable•=•$$_div3;↲    [generated] line 135          
         ╚╚╚                                                                                                            [generated] subset            
         ↲                                                                                                                                            
                  ↲                                                                                                                                   
         ╚╚╚</div>↲                                                                                                     [original] line 276 (rest generated at lines 133, 134)
                                                                                                                                                      
         ╚╚╚•{•const•$$_div3•=•svelteHTML.createElement("div",•{••"class":`chapter-markup`,});scrollable•=•$$_div3;↲    [generated] line 135          
            •{•const•$$_div3•=•svelteHTML.createElement("div",•{••"class":`chapter-markup`,});scrollable•=•$$_div3;↲    [generated] subset            
            <                                            div    "•c lass=  chapter-markup"    scrollable}          ↲                                  
                                                                 #                                                      Order-breaking mappings       
            <div class="chapter-markup"•           scrollable} ↲                                                                                      
         ╚╚╚<div•class="chapter-markup"•bind:this={scrollable}>↲                                                        [original] line 278 (rest generated at line 136)
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                 chapter.html;                                                                                                                        {/**
            ╚╚╚╚•chapter.html;↲                                        [generated] line 136                                                           
            ╚╚╚╚                                                       [generated] subset                                                             
            ↲                                                                                                                                         
                                                                  ↲                                                                                   
            ╚╚╚<div•class="chapter-markup"•bind:this={scrollable}>↲    [original] line 278 (rest generated at line 135)                               
                                                                                                                                                      
            ╚╚╚╚•chapter.html;↲                                        [generated] line 136                                                           
                •chapter.html;↲                                        [generated] subset                                                             
                {chapter.html}↲                                                                                                                       
                {      chapter.html}↲                                                                                                                 
            ╚╚╚╚{@html•chapter.html}↲                                  [original] line 279 (rest generated at lines 137, 138)                         
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲                            [generated] line 137                                                                                                     
                        ↲                                                                                                                             
╚╚╚╚{@html•chapter.html}↲    [original] line 279 (rest generated at lines 136, 138)                                                                   
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                 { svelteHTML.createElement("div", { "class":`controls`,});                                                                           {/**
            ╚╚╚╚•{•svelteHTML.createElement("div",•{•"class":`controls`,});↲    [generated] line 138                                                  
            ╚╚╚╚                                                                [generated] subset                                                    
            ↲                                                                                                                                         
                                    ↲                                                                                                                 
            ╚╚╚╚{@html•chapter.html}↲                                           [original] line 279 (rest generated at lines 136, 137)                
                                                                                                                                                      
            ╚╚╚╚•{•svelteHTML.createElement("div",•{•"class":`controls`,});↲    [generated] line 138                                                  
                •{•svelteHTML.createElement("div",•{•"class":`controls`,});↲    [generated] subset                                                    
                <                            div    "c lass=  controls"    ↲                                                                          
                                                    #                           Order-breaking mappings                                               
                <div class="controls" ↲                                                                                                               
            ╚╚╚╚<div•class="controls">↲                                         [original] line 281 (rest generated at line 139)                      
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                    if(chapter.app_b){                                                                                                                {/**
               ╚╚╚╚╚if(chapter.app_b){↲       [generated] line 139                                                                                    
               ╚╚╚╚╚                          [generated] subset                                                                                      
               ↲                                                                                                                                      
                                         ↲                                                                                                            
               ╚╚╚╚<div•class="controls">↲    [original] line 281 (rest generated at line 138)                                                        
                                                                                                                                                      
               ╚╚╚╚╚if(chapter.app_b){↲       [generated] line 139                                                                                    
                    if(chapter.app_b){↲       [generated] subset                                                                                      
                    {  chapter.app_b} ↲                                                                                                               
                    {    chapter.app_b}↲                                                                                                              
               ╚╚╚╚╚{#if•chapter.app_b}↲      [original] line 282                                                                                     
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
                  ╚╚╚╚╚╚↲                                                               [generated] line 140                                          
                  ╚╚╚╚╚╚                                                                [generated] subset                                            
                  ╚╚╚╚╚╚                                                                                                                              
                  ╚╚╚╚╚╚<!--•TODO•disable•this•button•when•the•contents•of•the•REPL↲    [original] line 283                                           
                                                                                                                                                      
                  ╚╚╚╚╚╚↲                                                               [generated] line 140                                          
                        ↲                                                               [generated] subset                                            
                                                            ↲                                                                                         
                  ╚╚╚╚╚╚╚matches•the•expected•end•result•-->↲                           [original] line 284 (rest generated at line 141)              
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                          { svelteHTML.createElement("button", {   "class":`show`,"on:click":() => completed ? reset() : complete(),});               {/**
                  ╚╚╚╚╚╚••{•svelteHTML.createElement("button",•{•••"class":`show`,"on:click":()•=>•completed•?•reset()•:•complete(),});↲    [generated] line 141
                  ╚╚╚╚╚╚                                                                                                                    [generated] subset
                  ↲                                                                                                                                   
                                                            ↲                                                                                         
                  ╚╚╚╚╚╚╚matches•the•expected•end•result•-->↲                                                                               [original] line 284 (rest generated at line 140)
                                                                                                                                                      
                  ╚╚╚╚╚╚••{•svelteHTML.createElement("button",•{•••"class":`show`,"on:click":()•=>•completed•?•reset()•:•complete(),});↲    [generated] line 141
                        ••{•svelteHTML.createElement("button",•{•••"class":`show`,"on:click":()•=>•completed•?•reset()•:•complete(),});↲    [generated] subset
                        <>                            button    "•"c lass=  show" c    lick =()•=>•completed•?•reset()•:•complete()}   ↲              
                         #============================            #                                                                         Order-breaking mappings
                        <button class="show"•   click=" ()•=>•completed•?•reset()•:•complete()} >↲                                                    
                  ╚╚╚╚╚╚<button•class="show"•on:click="{()•=>•completed•?•reset()•:•complete()}">↲                                          [original] line 285 (rest generated at line 142)
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                            completed ? 'Reset' : 'Show me';                                                                                          {/**
                     ╚╚╚╚╚╚╚completed•?•'Reset'•:•'Show•me';↲                                            [generated] line 142                         
                     ╚╚╚╚╚╚╚                                                                             [generated] subset                           
                     ↲                                                                                                                                
                                                                                                    ↲                                                 
                     ╚╚╚╚╚╚<button•class="show"•on:click="{()•=>•completed•?•reset()•:•complete()}">↲    [original] line 285 (rest generated at line 141)
                                                                                                                                                      
                     ╚╚╚╚╚╚╚completed•?•'Reset'•:•'Show•me';↲                                            [generated] line 142                         
                            completed•?•'Reset'•:•'Show•me';↲                                            [generated] subset                           
                            completed•?•'Reset'•:•'Show•me'}↲                                                                                         
                             completed•?•'Reset'•:•'Show•me'}↲                                                                                        
                     ╚╚╚╚╚╚╚{completed•?•'Reset'•:•'Show•me'}↲                                           [original] line 286 (rest generated at line 143)
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                         }                                                                                                                            {/**
                  ╚╚╚╚╚╚•}↲                                    [generated] line 143                                                                   
                  ╚╚╚╚╚╚                                       [generated] subset                                                                     
                  ↲                                                                                                                                   
                                                          ↲                                                                                           
                  ╚╚╚╚╚╚╚{completed•?•'Reset'•:•'Show•me'}↲    [original] line 286 (rest generated at line 142)                                       
                                                                                                                                                      
                  ╚╚╚╚╚╚•}↲                                    [generated] line 143                                                                   
                        •}↲                                    [generated] subset                                                                     
                        / ↲                                                                                                                           
                         /       ↲                                                                                                                    
                  ╚╚╚╚╚╚</button>↲                             [original] line 287                                                                    
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                    }                                                                                                                                 {/**
               ╚╚╚╚╚}↲        [generated] line 144                                                                                                    
               ╚╚╚╚╚{↲                                                                                                                                
               ╚╚╚╚╚{    ↲                                                                                                                            
               ╚╚╚╚╚{/if}↲    [original] line 288 (rest generated at lines 145, 146)                                                                  
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲              [generated] line 145                                                                                                                   
          ↲                                                                                                                                           
╚╚╚╚╚{/if}↲    [original] line 288 (rest generated at lines 144, 146)                                                                                 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                    if(selected.next){                                                                                                                {/**
               ╚╚╚╚╚if(selected.next){↲     [generated] line 146                                                                                      
               ╚╚╚╚╚                        [generated] subset                                                                                        
               ↲                                                                                                                                      
                         ↲                                                                                                                            
               ╚╚╚╚╚{/if}↲                  [original] line 288 (rest generated at lines 144, 145)                                                    
                                                                                                                                                      
               ╚╚╚╚╚if(selected.next){↲     [generated] line 146                                                                                      
                    if(selected.next){↲     [generated] subset                                                                                        
                    {  selected.next} ↲                                                                                                               
                    {    selected.next}↲                                                                                                              
               ╚╚╚╚╚{#if•selected.next}↲    [original] line 290                                                                                       
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                         { svelteHTML.createElement("a", {   "class":`next`,"href":`tutorial/${selected.next.slug}`,});  }                            {/**
                  ╚╚╚╚╚╚•{•svelteHTML.createElement("a",•{•••"class":`next`,"href":`tutorial/${selected.next.slug}`,});••}↲    [generated] line 147   
                  ╚╚╚╚╚╚<                            a    "•"c lass=  next" h ref=  tutorial/ {selected.next.slug}"    N/ ↲                           
                                                            #                                                                  Order-breaking mappings
                  ╚╚╚╚╚╚<a class="next"•href="tutorial/{selected.next.slug}" N    /  ↲                                                                
                  ╚╚╚╚╚╚<a•class="next"•href="tutorial/{selected.next.slug}">Next</a>↲                                         [original] line 291    
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                    }                                                                                                                                 {/**
               ╚╚╚╚╚}↲        [generated] line 148                                                                                                    
               ╚╚╚╚╚{↲                                                                                                                                
               ╚╚╚╚╚{    ↲                                                                                                                            
               ╚╚╚╚╚{/if}↲    [original] line 292 (rest generated at line 149)                                                                        
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                 }                                                                                                                                    {/**
            ╚╚╚╚•}↲        [generated] line 149                                                                                                       
            ╚╚╚╚           [generated] subset                                                                                                         
            ↲                                                                                                                                         
                      ↲                                                                                                                               
            ╚╚╚╚╚{/if}↲    [original] line 292 (rest generated at line 148)                                                                           
                                                                                                                                                      
            ╚╚╚╚•}↲        [generated] line 149                                                                                                       
                •}↲        [generated] subset                                                                                                         
                / ↲                                                                                                                                   
                 /    ↲                                                                                                                               
            ╚╚╚╚</div>↲    [original] line 293 (rest generated at lines 150, 151)                                                                     
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲              [generated] line 150                                                                                                                   
          ↲                                                                                                                                           
╚╚╚╚</div>↲    [original] line 293 (rest generated at lines 149, 151)                                                                                 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                 { svelteHTML.createElement("div", { "class":`improve-chapter`,});                                                                    {/**
            ╚╚╚╚•{•svelteHTML.createElement("div",•{•"class":`improve-chapter`,});↲    [generated] line 151                                           
            ╚╚╚╚                                                                       [generated] subset                                             
            ↲                                                                                                                                         
                      ↲                                                                                                                               
            ╚╚╚╚</div>↲                                                                [original] line 293 (rest generated at lines 149, 150)         
                                                                                                                                                      
            ╚╚╚╚•{•svelteHTML.createElement("div",•{•"class":`improve-chapter`,});↲    [generated] line 151                                           
                •{•svelteHTML.createElement("div",•{•"class":`improve-chapter`,});↲    [generated] subset                                             
                <                            div    "c lass=  improve-chapter"    ↲                                                                   
                                                    #                                  Order-breaking mappings                                        
                <div class="improve-chapter" ↲                                                                                                        
            ╚╚╚╚<div•class="improve-chapter">↲                                         [original] line 295 (rest generated at line 152)               
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                     { svelteHTML.createElement("a", {   "class":`no-underline`,"href":improve_link,});   }                                           {/**
               ╚╚╚╚╚•{•svelteHTML.createElement("a",•{•••"class":`no-underline`,"href":improve_link,});•••}↲    [generated] line 152                  
               ╚╚╚╚╚                                                                                            [generated] subset                    
               ↲                                                                                                                                      
                                                ↲                                                                                                     
               ╚╚╚╚<div•class="improve-chapter">↲                                                               [original] line 295 (rest generated at line 151)
                                                                                                                                                      
               ╚╚╚╚╚•{•svelteHTML.createElement("a",•{•••"class":`no-underline`,"href":improve_link,});•••}↲    [generated] line 152                  
                    •{•svelteHTML.createElement("a",•{•••"class":`no-underline`,"href":improve_link,});•••}↲    [generated] subset                    
                    <                            a    "•{c lass=  no-underline" h ref= improve_link}   E / ↲                                          
                                                        #                                                       Order-breaking mappings               
                    <a class="no-underline"•href={improve_link} E                 /  ↲                                                                
               ╚╚╚╚╚<a•class="no-underline"•href={improve_link}>Edit•this•chapter</a>↲                          [original] line 296 (rest generated at line 153)
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                 }                                                                                                                                    {/**
            ╚╚╚╚•}↲                                                                    [generated] line 153                                           
            ╚╚╚╚                                                                       [generated] subset                                             
            ↲                                                                                                                                         
                                                                                  ↲                                                                   
            ╚╚╚╚╚<a•class="no-underline"•href={improve_link}>Edit•this•chapter</a>↲    [original] line 296 (rest generated at line 152)               
                                                                                                                                                      
            ╚╚╚╚•}↲                                                                    [generated] line 153                                           
                •}↲                                                                    [generated] subset                                             
                / ↲                                                                                                                                   
                 /    ↲                                                                                                                               
            ╚╚╚╚</div>↲                                                                [original] line 297 (rest generated at line 154)               
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
             }                                                                                                                                        {/**
         ╚╚╚•}↲         [generated] line 154                                                                                                          
         ╚╚╚            [generated] subset                                                                                                            
         ↲                                                                                                                                            
                   ↲                                                                                                                                  
         ╚╚╚╚</div>↲    [original] line 297 (rest generated at line 153)                                                                              
                                                                                                                                                      
         ╚╚╚•}↲         [generated] line 154                                                                                                          
            •}↲         [generated] subset                                                                                                            
            / ↲                                                                                                                                       
             /    ↲                                                                                                                                   
         ╚╚╚</div>↲     [original] line 298 (rest generated at line 155)                                                                              
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
         }                                                                                                                                            {/**
      ╚╚•}↲         [generated] line 155                                                                                                              
      ╚╚            [generated] subset                                                                                                                
      ↲                                                                                                                                               
               ↲                                                                                                                                      
      ╚╚╚</div>↲    [original] line 298 (rest generated at line 154)                                                                                  
                                                                                                                                                      
      ╚╚•}↲         [generated] line 155                                                                                                              
        •}↲         [generated] subset                                                                                                                
        / ↲                                                                                                                                           
         /    ↲                                                                                                                                       
      ╚╚</div>↲     [original] line 299 (rest generated at lines 156, 157)                                                                            
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲            [generated] line 156                                                                                                                     
        ↲                                                                                                                                             
╚╚</div>↲    [original] line 299 (rest generated at lines 155, 157)                                                                                   
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
         { svelteHTML.createElement("div", { "class":`tutorial-repl`,});                                                                              {/**
      ╚╚•{•svelteHTML.createElement("div",•{•"class":`tutorial-repl`,});↲    [generated] line 157                                                     
      ╚╚                                                                     [generated] subset                                                       
      ↲                                                                                                                                               
              ↲                                                                                                                                       
      ╚╚</div>↲                                                              [original] line 299 (rest generated at lines 155, 156)                   
                                                                                                                                                      
      ╚╚•{•svelteHTML.createElement("div",•{•"class":`tutorial-repl`,});↲    [generated] line 157                                                     
        •{•svelteHTML.createElement("div",•{•"class":`tutorial-repl`,});↲    [generated] subset                                                       
        <                            div    "c lass=  tutorial-repl"    ↲                                                                             
                                            #                                Order-breaking mappings                                                  
        <div class="tutorial-repl" ↲                                                                                                                  
      ╚╚<div•class="tutorial-repl">↲                                         [original] line 301 (rest generated at line 158)                         
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
             { const $$_lpeR3C = __sveltets_2_ensureComponent(Repl); const $$_lpeR3 = new $$_lpeR3C({ target: __sveltets_2_any(), props: {               "workersUrl":`workers`,svelteUrl,rollupUrl,"orientation":mobile ? 'columns' : 'rows',"fixed":mobile,"injectedJS":mapbox_setup,"relaxed":true,}});repl = $$_lpeR3;$$_lpeR3.$on("change", handle_change);}{/**
         ╚╚╚•{•const•$$_lpeR3C•=•__sveltets_2_ensureComponent(Repl);•const•$$_lpeR3•=•new•$$_lpeR3C({•target:•__sveltets_2_any(),•props:•{•••••••••••••••"workersUrl":`workers`,svelteUrl,rollupUrl,"orientation":mobile•?•'columns'•:•'rows',"fixed":mobile,"injectedJS":mapbox_setup,"relaxed":true,}});repl•=•$$_lpeR3;$$_lpeR3.$on("change",•handle_change);}↲    [generated] line 158
         ╚╚╚                                                                                                                                                                                                                                                                                                                                                          [generated] subset
         ↲                                                                                                                                                                                                                                                                                                                                                            
                                      ↲                                                                                                                                                                                                                                                                                                                               
         ╚╚<div•class="tutorial-repl">↲                                                                                                                                                                                                                                                                                                                               [original] line 301 (rest generated at line 157)
                                                                                                                                                                                                                                                                                                                                                                      
         ╚╚╚•{•const•$$_lpeR3C•=•__sveltets_2_ensureComponent(Repl);•const•$$_lpeR3•=•new•$$_lpeR3C({•target:•__sveltets_2_any(),•props:•{•••••••••••••••"workersUrl":`workers`,svelteUrl,rollupUrl,"orientation":mobile•?•'columns'•:•'rows',"fixed":mobile,"injectedJS":mapbox_setup,"relaxed":true,}});repl•=•$$_lpeR3;$$_lpeR3.$on("change",•handle_change);}↲    [generated] line 158
            •{•const•$$_lpeR3C•=•__sveltets_2_ensureComponent(Repl);•const•$$_lpeR3•=•new•$$_lpeR3C({•target:•__sveltets_2_any(),•props:•{                                                                                                                                                                                                                            [generated] subset
            <                                                 Repl                                                                                                                                                                                                                                                                                                    
            <Repl                                                                                                                                                                                                                                                                                                                                                     
         ╚╚╚<Repl↲                                                                                                                                                                                                                                                                                                                                                    [original] line 302 
                                                                                                                                                                                                                                                                                                                                                                      
         ╚╚╚•{•const•$$_lpeR3C•=•__sveltets_2_ensureComponent(Repl);•const•$$_lpeR3•=•new•$$_lpeR3C({•target:•__sveltets_2_any(),•props:•{•••••••••••••••"workersUrl":`workers`,svelteUrl,rollupUrl,"orientation":mobile•?•'columns'•:•'rows',"fixed":mobile,"injectedJS":mapbox_setup,"relaxed":true,}});repl•=•$$_lpeR3;$$_lpeR3.$on("change",•handle_change);}↲    [generated] line 158
                                                                                                                                          ••                                                                                                                                                              repl•=•$$_lpeR3;$$_lpeR3.$on(                               [generated] subset
                                                                                                                                          ╚↲                                                                                                                                                              repl}                                                       
                                                                                                                                           #==============================================================================================================================================================                                                            Order-breaking mappings
          ╚             repl}↲                                                                                                                                                                                                                                                                                                                                        
         ╚╚╚╚bind:this={repl}↲                                                                                                                                                                                                                                                                                                                                        [original] line 303 
                                                                                                                                                                                                                                                                                                                                                                      
         ╚╚╚•{•const•$$_lpeR3C•=•__sveltets_2_ensureComponent(Repl);•const•$$_lpeR3•=•new•$$_lpeR3C({•target:•__sveltets_2_any(),•props:•{•••••••••••••••"workersUrl":`workers`,svelteUrl,rollupUrl,"orientation":mobile•?•'columns'•:•'rows',"fixed":mobile,"injectedJS":mapbox_setup,"relaxed":true,}});repl•=•$$_lpeR3;$$_lpeR3.$on("change",•handle_change);}↲    [generated] line 158
                                                                                                                                            ••           "workersUrl":`workers`,                                                                                                                                                                                      [generated] subset
                                                                                                                                            "↲           w orkersUrl=  workers"                                                                                                                                                                                       
                                                                                                                                             #===========                                                                                                                                                                                                             Order-breaking mappings
             workersUrl="workers"↲                                                                                                                                                                                                                                                                                                                                    
         ╚╚╚╚workersUrl="workers"↲                                                                                                                                                                                                                                                                                                                                    [original] line 304 
                                                                                                                                                                                                                                                                                                                                                                      
         ╚╚╚•{•const•$$_lpeR3C•=•__sveltets_2_ensureComponent(Repl);•const•$$_lpeR3•=•new•$$_lpeR3C({•target:•__sveltets_2_any(),•props:•{•••••••••••••••"workersUrl":`workers`,svelteUrl,rollupUrl,"orientation":mobile•?•'columns'•:•'rows',"fixed":mobile,"injectedJS":mapbox_setup,"relaxed":true,}});repl•=•$$_lpeR3;$$_lpeR3.$on("change",•handle_change);}↲    [generated] line 158
                                                                                                                                              •                                 svelteUrl,                                                                                                                                                                            [generated] subset
                                                                                                                                              ↲                                 svelteUrl}                                                                                                                                                                            
                                                                                                                                              #=================================                                                                                                                                                                                      Order-breaking mappings
              svelteUrl}↲                                                                                                                                                                                                                                                                                                                                             
         ╚╚╚╚{svelteUrl}↲                                                                                                                                                                                                                                                                                                                                             [original] line 305 
                                                                                                                                                                                                                                                                                                                                                                      
         ╚╚╚•{•const•$$_lpeR3C•=•__sveltets_2_ensureComponent(Repl);•const•$$_lpeR3•=•new•$$_lpeR3C({•target:•__sveltets_2_any(),•props:•{•••••••••••••••"workersUrl":`workers`,svelteUrl,rollupUrl,"orientation":mobile•?•'columns'•:•'rows',"fixed":mobile,"injectedJS":mapbox_setup,"relaxed":true,}});repl•=•$$_lpeR3;$$_lpeR3.$on("change",•handle_change);}↲    [generated] line 158
                                                                                                                                               •                                          rollupUrl,                                                                                                                                                                  [generated] subset
                                                                                                                                               ↲                                          rollupUrl}                                                                                                                                                                  
                                                                                                                                               #==========================================                                                                                                                                                                            Order-breaking mappings
              rollupUrl}↲                                                                                                                                                                                                                                                                                                                                             
         ╚╚╚╚{rollupUrl}↲                                                                                                                                                                                                                                                                                                                                             [original] line 306 
                                                                                                                                                                                                                                                                                                                                                                      
         ╚╚╚•{•const•$$_lpeR3C•=•__sveltets_2_ensureComponent(Repl);•const•$$_lpeR3•=•new•$$_lpeR3C({•target:•__sveltets_2_any(),•props:•{•••••••••••••••"workersUrl":`workers`,svelteUrl,rollupUrl,"orientation":mobile•?•'columns'•:•'rows',"fixed":mobile,"injectedJS":mapbox_setup,"relaxed":true,}});repl•=•$$_lpeR3;$$_lpeR3.$on("change",•handle_change);}↲    [generated] line 158
                                                                                                                                                ••                                                  "orientation":mobile•?•'columns'•:•'rows',                                                                                                                        [generated] subset
                                                                                                                                                {↲                                                  o rientation= mobile•?•'columns'•:•'rows'}                                                                                                                        
                                                                                                                                                 #==================================================                                                                                                                                                                  Order-breaking mappings
             orientation={mobile•?•'columns'•:•'rows'}↲                                                                                                                                                                                                                                                                                                               
         ╚╚╚╚orientation={mobile•?•'columns'•:•'rows'}↲                                                                                                                                                                                                                                                                                                               [original] line 307 
                                                                                                                                                                                                                                                                                                                                                                      
         ╚╚╚•{•const•$$_lpeR3C•=•__sveltets_2_ensureComponent(Repl);•const•$$_lpeR3•=•new•$$_lpeR3C({•target:•__sveltets_2_any(),•props:•{•••••••••••••••"workersUrl":`workers`,svelteUrl,rollupUrl,"orientation":mobile•?•'columns'•:•'rows',"fixed":mobile,"injectedJS":mapbox_setup,"relaxed":true,}});repl•=•$$_lpeR3;$$_lpeR3.$on("change",•handle_change);}↲    [generated] line 158
                                                                                                                                                  ••                                                                                          "fixed":mobile,                                                                                                         [generated] subset
                                                                                                                                                  {↲                                                                                          f ixed= mobile}                                                                                                         
                                                                                                                                                   #==========================================================================================                                                                                                                        Order-breaking mappings
             fixed={mobile}↲                                                                                                                                                                                                                                                                                                                                          
         ╚╚╚╚fixed={mobile}↲                                                                                                                                                                                                                                                                                                                                          [original] line 308 
                                                                                                                                                                                                                                                                                                                                                                      
         ╚╚╚•{•const•$$_lpeR3C•=•__sveltets_2_ensureComponent(Repl);•const•$$_lpeR3•=•new•$$_lpeR3C({•target:•__sveltets_2_any(),•props:•{•••••••••••••••"workersUrl":`workers`,svelteUrl,rollupUrl,"orientation":mobile•?•'columns'•:•'rows',"fixed":mobile,"injectedJS":mapbox_setup,"relaxed":true,}});repl•=•$$_lpeR3;$$_lpeR3.$on("change",•handle_change);}↲    [generated] line 158
                                                                                                                                                    ••                                                                                                                                                                                 "change",•handle_change);}     [generated] subset
                                                                                                                                                    {↲                                                                                                                                                                                 c hange = handle_change}       
                                                                                                                                                     #=================================================================================================================================================================================                               Order-breaking mappings
                change={handle_change}↲                                                                                                                                                                                                                                                                                                                               
         ╚╚╚╚on:change={handle_change}↲                                                                                                                                                                                                                                                                                                                               [original] line 309 
                                                                                                                                                                                                                                                                                                                                                                      
         ╚╚╚•{•const•$$_lpeR3C•=•__sveltets_2_ensureComponent(Repl);•const•$$_lpeR3•=•new•$$_lpeR3C({•target:•__sveltets_2_any(),•props:•{•••••••••••••••"workersUrl":`workers`,svelteUrl,rollupUrl,"orientation":mobile•?•'columns'•:•'rows',"fixed":mobile,"injectedJS":mapbox_setup,"relaxed":true,}});repl•=•$$_lpeR3;$$_lpeR3.$on("change",•handle_change);}↲    [generated] line 158
                                                                                                                                                      ••                                                                                                     "injectedJS":mapbox_setup,                                                                               [generated] subset
                                                                                                                                                      {↲                                                                                                     i njectedJS= mapbox_setup}                                                                               
                                                                                                                                                       #=====================================================================================================                                                                                                         Order-breaking mappings
             injectedJS={mapbox_setup}↲                                                                                                                                                                                                                                                                                                                               
         ╚╚╚╚injectedJS={mapbox_setup}↲                                                                                                                                                                                                                                                                                                                               [original] line 310 
                                                                                                                                                                                                                                                                                                                                                                      
         ╚╚╚•{•const•$$_lpeR3C•=•__sveltets_2_ensureComponent(Repl);•const•$$_lpeR3•=•new•$$_lpeR3C({•target:•__sveltets_2_any(),•props:•{•••••••••••••••"workersUrl":`workers`,svelteUrl,rollupUrl,"orientation":mobile•?•'columns'•:•'rows',"fixed":mobile,"injectedJS":mapbox_setup,"relaxed":true,}});repl•=•$$_lpeR3;$$_lpeR3.$on("change",•handle_change);}↲    [generated] line 158
                                                                                                                                                                                                                                                                                       "relaxed":true,}});                                                            [generated] subset
                                                                                                                                                                                                                                                                                       r elaxed↲                                                                      
             relaxed↲                                                                                                                                                                                                                                                                                                                                                 
         ╚╚╚╚relaxed↲                                                                                                                                                                                                                                                                                                                                                 [original] line 311 
                                                                                                                                                                                                                                                                                                                                                                      
         ╚╚╚•{•const•$$_lpeR3C•=•__sveltets_2_ensureComponent(Repl);•const•$$_lpeR3•=•new•$$_lpeR3C({•target:•__sveltets_2_any(),•props:•{•••••••••••••••"workersUrl":`workers`,svelteUrl,rollupUrl,"orientation":mobile•?•'columns'•:•'rows',"fixed":mobile,"injectedJS":mapbox_setup,"relaxed":true,}});repl•=•$$_lpeR3;$$_lpeR3.$on("change",•handle_change);}↲    [generated] line 158
                                                                                                                                                        •                                                                                                                                                                                                        ↲    [generated] subset
                                                                                                                                                        ╚                                                                                                                                                                                                        ↲    
          ╚   ↲                                                                                                                                                                                                                                                                                                                                                       
         ╚╚╚/>↲                                                                                                                                                                                                                                                                                                                                                       [original] line 312 (rest generated at line 159)
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
         }                                                                                                                                            {/**
      ╚╚•}↲        [generated] line 159                                                                                                               
      ╚╚           [generated] subset                                                                                                                 
      ↲                                                                                                                                               
           ↲                                                                                                                                          
      ╚╚╚/>↲       [original] line 312 (rest generated at line 158)                                                                                   
                                                                                                                                                      
      ╚╚•}↲        [generated] line 159                                                                                                               
        •}↲        [generated] subset                                                                                                                 
        / ↲                                                                                                                                           
         /    ↲                                                                                                                                       
      ╚╚</div>↲    [original] line 313 (rest generated at line 160)                                                                                   
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     }                                                                                                                                                {/**
   ╚•}↲         [generated] line 160                                                                                                                  
   ╚            [generated] subset                                                                                                                    
   ↲                                                                                                                                                  
           ↲                                                                                                                                          
   ╚╚</div>↲    [original] line 313 (rest generated at line 159)                                                                                      
                                                                                                                                                      
   ╚•}↲         [generated] line 160                                                                                                                  
    •}↲         [generated] subset                                                                                                                    
    / ↲                                                                                                                                               
     /    ↲                                                                                                                                           
   ╚</div>↲     [original] line 314 (rest generated at lines 161, 162)                                                                                
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲           [generated] line 161                                                                                                                      
       ↲                                                                                                                                              
╚</div>↲    [original] line 314 (rest generated at lines 160, 162)                                                                                    
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    if(mobile){                                                                                                                                       {/**
   ╚if(mobile){↲     [generated] line 162                                                                                                             
   ╚                 [generated] subset                                                                                                               
   ↲                                                                                                                                                  
          ↲                                                                                                                                           
   ╚</div>↲          [original] line 314 (rest generated at lines 160, 161)                                                                           
                                                                                                                                                      
   ╚if(mobile){↲     [generated] line 162                                                                                                             
    if(mobile){↲     [generated] subset                                                                                                               
    {  mobile} ↲                                                                                                                                      
    {    mobile}↲                                                                                                                                     
   ╚{#if•mobile}↲    [original] line 316                                                                                                              
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
          { const $$_elggoTneercS1C = __sveltets_2_ensureComponent(ScreenToggle); new $$_elggoTneercS1C({ target: __sveltets_2_any(), props: {  offset,"labels":['tutorial', 'input', 'output'],}});/*Ωignore_startΩ*/() => offset = __sveltets_2_any(null);/*Ωignore_endΩ*/}{/**
      ╚╚••{•const•$$_elggoTneercS1C•=•__sveltets_2_ensureComponent(ScreenToggle);•new•$$_elggoTneercS1C({•target:•__sveltets_2_any(),•props:•{••offset,"labels":['tutorial',•'input',•'output'],}});/*Ωignore_startΩ*/()•=>•offset•=•__sveltets_2_any(null);/*Ωignore_endΩ*/}↲    [generated] line 163
      ╚╚<>                                                         ScreenToggle                                                               i{offset•l abels= ['tutorial',•'input',•'output']}                                                                             ↲    
         #=========================================================                                                                            #                                                                                                                                  Order-breaking mappings
      ╚╚<ScreenToggle  i   offset•labels={['tutorial',•'input',•'output']} >↲                                                                                                                                                                                                     
      ╚╚<ScreenToggle•bind:offset•labels={['tutorial',•'input',•'output']}/>↲                                                                                                                                                                                                     [original] line 317 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    }                                                                                                                                                 {/**
   ╚}↲        [generated] line 164                                                                                                                    
   ╚{↲                                                                                                                                                
   ╚{    ↲                                                                                                                                            
   ╚{/if}↲    [original] line 318                                                                                                                     
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
 }};                                                                                                                                                  {/**
•}};↲     [generated] line 165                                                                                                                        
/                                                                                                                                                     
 /                                                                                                                                                    
</div>    [original] line 319                                                                                                                         
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
return { props: {slug: slug , chapter: chapter}, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event($$render()))) {
}