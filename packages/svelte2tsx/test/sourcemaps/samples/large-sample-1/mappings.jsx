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
</script>↲    [original] line 14 (rest generated at lines 119, 120)                                                                                   
                                                                                                                                                      
;;↲           [generated] line 15                                                                                                                     
 ;↲           [generated] subset                                                                                                                      
 <                                                                                                                                                    
<                                                                                                                                                     
<script>↲     [original] line 16 (rest generated at lines 28, 29)                                                                                     
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**

------------------------------------------------------------------------------------------------------------------------------------------------------ */}
import Repl from '@sveltejs/svelte-repl';                                                                                                             {/**
import•Repl•from•'@sveltejs/svelte-repl';↲     [generated] line 17                                                                                    
import•Repl•from•'@sveltejs/svelte-repl';                                                                                                             
 import•Repl•from•'@sveltejs/svelte-repl';                                                                                                            
╚import•Repl•from•'@sveltejs/svelte-repl';↲    [original] line 17 (rest generated at line 30)                                                         
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
import { getContext } from 'svelte';                                                                                                                  {/**
import•{•getContext•}•from•'svelte';↲     [generated] line 18                                                                                         
import•{•getContext•}•from•'svelte';                                                                                                                  
 import•{•getContext•}•from•'svelte';                                                                                                                 
╚import•{•getContext•}•from•'svelte';↲    [original] line 18 (rest generated at line 31)                                                              
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**

------------------------------------------------------------------------------------------------------------------------------------------------------ */}
import ScreenToggle from '../../../components/ScreenToggle.svelte';                                                                                   {/**
import•ScreenToggle•from•'../../../components/ScreenToggle.svelte';↲     [generated] line 20                                                          
import•ScreenToggle•from•'../../../components/ScreenToggle.svelte';                                                                                   
 import•ScreenToggle•from•'../../../components/ScreenToggle.svelte';                                                                                  
╚import•ScreenToggle•from•'../../../components/ScreenToggle.svelte';↲    [original] line 20 (rest generated at line 33)                               
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
import TableOfContents from './_TableOfContents.svelte';                                                                                              {/**
import•TableOfContents•from•'./_TableOfContents.svelte';↲     [generated] line 21                                                                     
import•TableOfContents•from•'./_TableOfContents.svelte';                                                                                              
 import•TableOfContents•from•'./_TableOfContents.svelte';                                                                                             
╚import•TableOfContents•from•'./_TableOfContents.svelte';↲    [original] line 21 (rest generated at line 34)                                          
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**

------------------------------------------------------------------------------------------------------------------------------------------------------ */}
import {                                                                                                                                              {/**
import•{↲     [generated] line 23                                                                                                                     
 import•{↲                                                                                                                                            
╚import•{↲    [original] line 23 (rest generated at line 36)                                                                                          
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
        mapbox_setup, // needed for context API tutorial
        rollupUrl,
        svelteUrl                                                                                                                                     {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    } from '../../../config';                                                                                                                         {/**
   ╚}•from•'../../../config';↲    [generated] line 27                                                                                                 
   ╚}•from•'../../../config';                                                                                                                         
   ╚}•from•'../../../config';↲    [original] line 27 (rest generated at line 36)                                                                      
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
function render() {                                                                                                                                   {/**
function•render()•{↲    [generated] line 28                                                                                                           
s                                                                                                                                                     
 s                                                                                                                                                    
<script>↲               [original] line 16 (rest generated at lines 15, 29)                                                                           
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲            [generated] line 29                                                                                                                      
        ↲                                                                                                                                             
<script>↲    [original] line 16 (rest generated at lines 15, 28)                                                                                      
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
   ╚↲                                             [generated] line 30                                                                                 
   ╚                                         ↲                                                                                                        
   ╚import•Repl•from•'@sveltejs/svelte-repl';↲    [original] line 17 (rest generated at line 17)                                                      
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
   ╚↲                                        [generated] line 31                                                                                      
   ╚                                    ↲                                                                                                             
   ╚import•{•getContext•}•from•'svelte';↲    [original] line 18 (rest generated at line 18)                                                           
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
   ╚↲                                                                       [generated] line 33                                                       
   ╚                                                                   ↲                                                                              
   ╚import•ScreenToggle•from•'../../../components/ScreenToggle.svelte';↲    [original] line 20 (rest generated at line 20)                            
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
   ╚↲                                                            [generated] line 34                                                                  
   ╚                                                        ↲                                                                                         
   ╚import•TableOfContents•from•'./_TableOfContents.svelte';↲    [original] line 21 (rest generated at line 21)                                       
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
   ╚↲                             [generated] line 36                                                                                                 
   ╚                              [generated] subset                                                                                                  
   ╚                                                                                                                                                  
   ╚import•{↲                     [original] line 23 (rest generated at line 23)                                                                      
                                                                                                                                                      
   ╚↲                             [generated] line 36                                                                                                 
    ↲                             [generated] subset                                                                                                  
                             ↲                                                                                                                        
   ╚}•from•'../../../config';↲    [original] line 27 (rest generated at line 27)                                                                      
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     let slug/*Ωignore_startΩ*/;slug = __sveltets_2_any(slug);/*Ωignore_endΩ*/;                                                                       {/**
   ╚•let•slug/*Ωignore_startΩ*/;slug•=•__sveltets_2_any(slug);/*Ωignore_endΩ*/;↲    [generated] line 38                                               
   ╚•let•slug;                                                                 ↲                                                                      
   ╚      •let•slug;↲                                                                                                                                 
   ╚export•let•slug;↲                                                               [original] line 29                                                
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     let chapter/*Ωignore_startΩ*/;chapter = __sveltets_2_any(chapter);/*Ωignore_endΩ*/;                                                              {/**
   ╚•let•chapter/*Ωignore_startΩ*/;chapter•=•__sveltets_2_any(chapter);/*Ωignore_endΩ*/;↲    [generated] line 39                                      
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
   ╚;()•=>•{$:•if•(scrollable)•chapter,•scrollable.scrollTo(0,•0);}↲    [generated] line 70                                                           
   ╚        $:•if•(scrollable)•chapter,•scrollable.scrollTo(0,•0);↲                                                                                   
   ╚$:•if•(scrollable)•chapter,•scrollable.scrollTo(0,•0);↲             [original] line 61                                                            
------------------------------------------------------------------------------------------------------------------------------------------------------ */}

    // TODO: this will need to be changed to the master branch, and probably should be dynamic instead of included
    //   here statically
    const tutorial_repo_link = 'https://github.com/sveltejs/svelte/tree/master/site/content/tutorial';
                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    let  selected = __sveltets_2_invalidate(() => lookup.get(slug));                                                                                  {/**
   ╚let••selected•=•__sveltets_2_invalidate(()•=>•lookup.get(slug));↲    [generated] line 76                                                          
   ╚    •selected•=•                              lookup.get(slug); ↲                                                                                 
   ╚  •selected•=•lookup.get(slug);↲                                                                                                                  
   ╚$:•selected•=•lookup.get(slug);↲                                     [original] line 67                                                           
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    let  improve_link = __sveltets_2_invalidate(() => `${tutorial_repo_link}/${selected.chapter.section_dir}/${selected.chapter.chapter_dir}`);       {/**
   ╚let••improve_link•=•__sveltets_2_invalidate(()•=>•`${tutorial_repo_link}/${selected.chapter.section_dir}/${selected.chapter.chapter_dir}`);↲    [generated] line 77
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
   ╚;()•=>•{$:•if•(repl)•{↲    [generated] line 85                                                                                                    
   ╚        $:•if•(repl)•{↲                                                                                                                           
   ╚$:•if•(repl)•{↲            [original] line 76                                                                                                     
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
        completed = false;
        repl.set({
            components: chapter.app_a.map(clone)
        });                                                                                                                                           {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    }}                                                                                                                                                {/**
   ╚}}↲    [generated] line 90                                                                                                                        
   ╚}↲     [original] line 81                                                                                                                         
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    let  mobile = __sveltets_2_invalidate(() => width < 768);                                                                                         {/**
   ╚let••mobile•=•__sveltets_2_invalidate(()•=>•width•<•768);↲    [generated] line 92                                                                 
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
;↲            [generated] line 118                                                                                                                    
<                                                                                                                                                     
</script>↲    [original] line 109 (rest generated at lines 119, 121, 122)                                                                             
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
async () => {                                                                                                                                         {/**
async•()•=>•{↲    [generated] line 119                                                                                                                
async•()•=>•{     [generated] subset                                                                                                                  
<                                                                                                                                                     
</script>↲        [original] line 109 (rest generated at lines 118, 121, 122)                                                                         
                                                                                                                                                      
async•()•=>•{↲    [generated] line 119                                                                                                                
             ↲    [generated] subset                                                                                                                  
         ↲                                                                                                                                            
</script>↲        [original] line 14 (rest generated at lines 15, 120)                                                                                
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲             [generated] line 120                                                                                                                    
         ↲                                                                                                                                            
</script>↲    [original] line 14 (rest generated at lines 15, 119)                                                                                    
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲             [generated] line 121                                                                                                                    
         ↲                                                                                                                                            
</script>↲    [original] line 109 (rest generated at lines 118, 119, 122)                                                                             
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲             [generated] line 122                                                                                                                    
         ↲                                                                                                                                            
</script>↲    [original] line 109 (rest generated at lines 118, 119, 121)                                                                             
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲            [generated] line 123                                                                                                                     
        ↲                                                                                                                                             
</style>↲    [original] line 259 (rest generated at line 124)                                                                                         
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲            [generated] line 124                                                                                                                     
        ↲                                                                                                                                             
</style>↲    [original] line 259 (rest generated at line 123)                                                                                         
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
 { svelteHTML.createElement("svelte:head", {});                                                                                                       {/**
•{•svelteHTML.createElement("svelte:head",•{});↲    [generated] line 125                                                                              
s                                              ↲                                                                                                      
 s           ↲                                                                                                                                        
<svelte:head>↲                                      [original] line 261 (rest generated at line 126)                                                  
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     { svelteHTML.createElement("title", {});selected.section.title;  selected.chapter.title;    }                                                    {/**
   ╚•{•svelteHTML.createElement("title",•{});selected.section.title;••selected.chapter.title;••••}↲    [generated] line 126                           
   ╚                                                                                                   [generated] subset                             
   ↲                                                                                                                                                  
                ↲                                                                                                                                     
   <svelte:head>↲                                                                                      [original] line 261 (rest generated at line 125)
                                                                                                                                                      
   ╚•{•svelteHTML.createElement("title",•{});selected.section.title;••selected.chapter.title;••••}↲    [generated] line 126                           
    •{•svelteHTML.createElement("title",•{});selected.section.title;••selected.chapter.title;••••}↲    [generated] subset                             
    <                            title       selected.section.title}• selected.chapter.title}•  / ↲                                                   
    <title  selected.section.title}•   selected.chapter.title}•                  /      ↲                                                             
   ╚<title>{selected.section.title}•/•{selected.chapter.title}•••Svelte•Tutorial</title>↲              [original] line 262 (rest generated at lines 127, 128)
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲                                                                                         [generated] line 127                                        
                                                                                     ↲                                                                
╚<title>{selected.section.title}•/•{selected.chapter.title}•••Svelte•Tutorial</title>↲    [original] line 262 (rest generated at lines 126, 128)      
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     { svelteHTML.createElement("meta", {   "name":`twitter:title`,"content":`Svelte tutorial`,});}                                                   {/**
   ╚•{•svelteHTML.createElement("meta",•{•••"name":`twitter:title`,"content":`Svelte•tutorial`,});}↲    [generated] line 128                          
   ╚                                                                                                    [generated] subset                            
   ↲                                                                                                                                                  
                                                                                        ↲                                                             
   ╚<title>{selected.section.title}•/•{selected.chapter.title}•••Svelte•Tutorial</title>↲               [original] line 262 (rest generated at lines 126, 127)
                                                                                                                                                      
   ╚•{•svelteHTML.createElement("meta",•{•••"name":`twitter:title`,"content":`Svelte•tutorial`,});}↲    [generated] line 128                          
    •{•svelteHTML.createElement("meta",•{•••"name":`twitter:title`,"content":`Svelte•tutorial`,});}↲    [generated] subset                            
    <                            meta    "•"n ame=  twitter:title" c ontent=  Svelte•tutorial"     ↲                                                  
                                           #                                                            Order-breaking mappings                       
    <meta name="twitter:title"•content="Svelte•tutorial" ↲                                                                                            
   ╚<meta•name="twitter:title"•content="Svelte•tutorial">↲                                              [original] line 264 (rest generated at line 129)
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     { svelteHTML.createElement("meta", {   "name":`twitter:description`,"content":`${selected.section.title} / ${selected.chapter.title}`,});}       {/**
   ╚•{•svelteHTML.createElement("meta",•{•••"name":`twitter:description`,"content":`${selected.section.title}•/•${selected.chapter.title}`,});}↲    [generated] line 129
   ╚                                                                                                                                                [generated] subset
   ↲                                                                                                                                                  
                                                         ↲                                                                                            
   ╚<meta•name="twitter:title"•content="Svelte•tutorial">↲                                                                                          [original] line 264 (rest generated at line 128)
                                                                                                                                                      
   ╚•{•svelteHTML.createElement("meta",•{•••"name":`twitter:description`,"content":`${selected.section.title}•/•${selected.chapter.title}`,});}↲    [generated] line 129
    •{•svelteHTML.createElement("meta",•{•••"name":`twitter:description`,"content":`${selected.section.title}•/•${selected.chapter.title}`,});}↲    [generated] subset
    <                            meta    "•"n ame=  twitter:description" c ontent=   {selected.section.title}•/• {selected.chapter.title}"     ↲      
                                           #                                                                                                        Order-breaking mappings
    <meta name="twitter:description"•content="{selected.section.title}•/•{selected.chapter.title}" ↲                                                  
   ╚<meta•name="twitter:description"•content="{selected.section.title}•/•{selected.chapter.title}">↲                                                [original] line 265 (rest generated at line 130)
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     { svelteHTML.createElement("meta", {   "name":`Description`,"content":`${selected.section.title} / ${selected.chapter.title}`,});}               {/**
   ╚•{•svelteHTML.createElement("meta",•{•••"name":`Description`,"content":`${selected.section.title}•/•${selected.chapter.title}`,});}↲    [generated] line 130
   ╚                                                                                                                                        [generated] subset
   ↲                                                                                                                                                  
                                                                                                   ↲                                                  
   ╚<meta•name="twitter:description"•content="{selected.section.title}•/•{selected.chapter.title}">↲                                        [original] line 265 (rest generated at line 129)
                                                                                                                                                      
   ╚•{•svelteHTML.createElement("meta",•{•••"name":`Description`,"content":`${selected.section.title}•/•${selected.chapter.title}`,});}↲    [generated] line 130
    •{•svelteHTML.createElement("meta",•{•••"name":`Description`,"content":`${selected.section.title}•/•${selected.chapter.title}`,});}↲    [generated] subset
    <                            meta    "•"n ame=  Description" c ontent=   {selected.section.title}•/• {selected.chapter.title}"     ↲              
                                           #                                                                                                Order-breaking mappings
    <meta name="Description"•content="{selected.section.title}•/•{selected.chapter.title}" ↲                                                          
   ╚<meta•name="Description"•content="{selected.section.title}•/•{selected.chapter.title}">↲                                                [original] line 266 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
 }                                                                                                                                                    {/**
•}↲                [generated] line 131                                                                                                               
/ ↲                                                                                                                                                   
 /            ↲                                                                                                                                       
</svelte:head>↲    [original] line 267 (rest generated at line 132)                                                                                   
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲                  [generated] line 132                                                                                                               
              ↲                                                                                                                                       
</svelte:head>↲    [original] line 267 (rest generated at line 131)                                                                                   
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
  { svelteHTML.createElement("svelte:window", { "bind:innerWidth":width,});/*Ωignore_startΩ*/() => width = __sveltets_2_any(null);/*Ωignore_endΩ*/}   {/**
••{•svelteHTML.createElement("svelte:window",•{•"bind:innerWidth":width,});/*Ωignore_startΩ*/()•=>•width•=•__sveltets_2_any(null);/*Ωignore_endΩ*/}↲    [generated] line 133
<>                                             ib                 width}                                                                           ↲    
 #=============================================#                                                                                                        Order-breaking mappings
<              bi               width} >↲                                                                                                               
<svelte:window•bind:innerWidth={width}/>↲                                                                                                               [original] line 269 (rest generated at line 134)
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲                                            [generated] line 134                                                                                     
                                        ↲                                                                                                             
<svelte:window•bind:innerWidth={width}/>↲    [original] line 269 (rest generated at line 133)                                                         
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
 { svelteHTML.createElement("div", { "class":`tutorial-outer`,});                                                                                     {/**
•{•svelteHTML.createElement("div",•{•"class":`tutorial-outer`,});↲    [generated] line 135                                                            
<                            div    "c lass=  tutorial-outer"    ↲                                                                                    
                                    #                                 Order-breaking mappings                                                         
<div class="tutorial-outer" ↲                                                                                                                         
<div•class="tutorial-outer">↲                                         [original] line 271 (rest generated at line 136)                                
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     { svelteHTML.createElement("div", { "class":`viewport offset-${offset}`,});                                                                      {/**
   ╚•{•svelteHTML.createElement("div",•{•"class":`viewport•offset-${offset}`,});↲    [generated] line 136                                             
   ╚                                                                                 [generated] subset                                               
   ↲                                                                                                                                                  
                               ↲                                                                                                                      
   <div•class="tutorial-outer">↲                                                     [original] line 271 (rest generated at line 135)                 
                                                                                                                                                      
   ╚•{•svelteHTML.createElement("div",•{•"class":`viewport•offset-${offset}`,});↲    [generated] line 136                                             
    •{•svelteHTML.createElement("div",•{•"class":`viewport•offset-${offset}`,});↲    [generated] subset                                               
    <                            div    "c lass=  viewport•offset- {offset}"    ↲                                                                     
                                        #                                            Order-breaking mappings                                          
    <div class="viewport•offset-{offset}" ↲                                                                                                           
   ╚<div•class="viewport•offset-{offset}">↲                                          [original] line 272 (rest generated at line 137)                 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
         { svelteHTML.createElement("div", { "class":`tutorial-text`,});                                                                              {/**
      ╚╚•{•svelteHTML.createElement("div",•{•"class":`tutorial-text`,});↲    [generated] line 137                                                     
      ╚╚                                                                     [generated] subset                                                       
      ↲                                                                                                                                               
                                             ↲                                                                                                        
      ╚<div•class="viewport•offset-{offset}">↲                               [original] line 272 (rest generated at line 136)                         
                                                                                                                                                      
      ╚╚•{•svelteHTML.createElement("div",•{•"class":`tutorial-text`,});↲    [generated] line 137                                                     
        •{•svelteHTML.createElement("div",•{•"class":`tutorial-text`,});↲    [generated] subset                                                       
        <                            div    "c lass=  tutorial-text"    ↲                                                                             
                                            #                                Order-breaking mappings                                                  
        <div class="tutorial-text" ↲                                                                                                                  
      ╚╚<div•class="tutorial-text">↲                                         [original] line 273 (rest generated at line 138)                         
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
             { svelteHTML.createElement("div", { "class":`table-of-contents`,});                                                                      {/**
         ╚╚╚•{•svelteHTML.createElement("div",•{•"class":`table-of-contents`,});↲    [generated] line 138                                             
         ╚╚╚                                                                         [generated] subset                                               
         ↲                                                                                                                                            
                                      ↲                                                                                                               
         ╚╚<div•class="tutorial-text">↲                                              [original] line 273 (rest generated at line 137)                 
                                                                                                                                                      
         ╚╚╚•{•svelteHTML.createElement("div",•{•"class":`table-of-contents`,});↲    [generated] line 138                                             
            •{•svelteHTML.createElement("div",•{•"class":`table-of-contents`,});↲    [generated] subset                                               
            <                            div    "c lass=  table-of-contents"    ↲                                                                     
                                                #                                    Order-breaking mappings                                          
            <div class="table-of-contents" ↲                                                                                                          
         ╚╚╚<div•class="table-of-contents">↲                                         [original] line 274 (rest generated at line 139)                 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                  { const $$_stnetnoCfOelbaT4C = __sveltets_2_ensureComponent(TableOfContents); new $$_stnetnoCfOelbaT4C({ target: __sveltets_2_any(), props: {  sections,slug,selected,}});}{/**
            ╚╚╚╚••{•const•$$_stnetnoCfOelbaT4C•=•__sveltets_2_ensureComponent(TableOfContents);•new•$$_stnetnoCfOelbaT4C({•target:•__sveltets_2_any(),•props:•{••sections,slug,selected,}});}↲    [generated] line 139
            ╚╚╚╚                                                                                                                                                                                  [generated] subset
            ↲                                                                                                                                                                                     
                                              ↲                                                                                                                                                   
            ╚╚╚<div•class="table-of-contents">↲                                                                                                                                                   [original] line 274 (rest generated at line 138)
                                                                                                                                                                                                  
            ╚╚╚╚••{•const•$$_stnetnoCfOelbaT4C•=•__sveltets_2_ensureComponent(TableOfContents);•new•$$_stnetnoCfOelbaT4C({•target:•__sveltets_2_any(),•props:•{••sections,slug,selected,}});}↲    [generated] line 139
                ••{•const•$$_stnetnoCfOelbaT4C•=•__sveltets_2_ensureComponent(TableOfContents);•new•$$_stnetnoCfOelbaT4C({•target:•__sveltets_2_any(),•props:•{••sections,slug,selected,}});}↲    [generated] subset
                <>                                                            TableOfContents                                                                  ••sections}slug}selected}     ↲    
                 #============================================================                                                                                  #                                 Order-breaking mappings
                <TableOfContents  sections}• slug}• selected} >↲                                                                                                                                  
            ╚╚╚╚<TableOfContents•{sections}•{slug}•{selected}/>↲                                                                                                                                  [original] line 275 (rest generated at line 140)
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
             }                                                                                                                                        {/**
         ╚╚╚•}↲                                                  [generated] line 140                                                                 
         ╚╚╚                                                     [generated] subset                                                                   
         ↲                                                                                                                                            
                                                            ↲                                                                                         
         ╚╚╚╚<TableOfContents•{sections}•{slug}•{selected}/>↲    [original] line 275 (rest generated at line 139)                                     
                                                                                                                                                      
         ╚╚╚•}↲                                                  [generated] line 140                                                                 
            •}↲                                                  [generated] subset                                                                   
            / ↲                                                                                                                                       
             /    ↲                                                                                                                                   
         ╚╚╚</div>↲                                              [original] line 276 (rest generated at lines 141, 142)                               
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲             [generated] line 141                                                                                                                    
         ↲                                                                                                                                            
╚╚╚</div>↲    [original] line 276 (rest generated at lines 140, 142)                                                                                  
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
             { const $$_div3 = svelteHTML.createElement("div", {  "class":`chapter-markup`,});scrollable = $$_div3;                                   {/**
         ╚╚╚•{•const•$$_div3•=•svelteHTML.createElement("div",•{••"class":`chapter-markup`,});scrollable•=•$$_div3;↲    [generated] line 142          
         ╚╚╚                                                                                                            [generated] subset            
         ↲                                                                                                                                            
                  ↲                                                                                                                                   
         ╚╚╚</div>↲                                                                                                     [original] line 276 (rest generated at lines 140, 141)
                                                                                                                                                      
         ╚╚╚•{•const•$$_div3•=•svelteHTML.createElement("div",•{••"class":`chapter-markup`,});scrollable•=•$$_div3;↲    [generated] line 142          
            •{•const•$$_div3•=•svelteHTML.createElement("div",•{••"class":`chapter-markup`,});scrollable•=•$$_div3;↲    [generated] subset            
            <                                            div    "•c lass=  chapter-markup"    scrollable}          ↲                                  
                                                                 #                                                      Order-breaking mappings       
            <div class="chapter-markup"•           scrollable} ↲                                                                                      
         ╚╚╚<div•class="chapter-markup"•bind:this={scrollable}>↲                                                        [original] line 278 (rest generated at line 143)
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                 chapter.html;                                                                                                                        {/**
            ╚╚╚╚•chapter.html;↲                                        [generated] line 143                                                           
            ╚╚╚╚                                                       [generated] subset                                                             
            ↲                                                                                                                                         
                                                                  ↲                                                                                   
            ╚╚╚<div•class="chapter-markup"•bind:this={scrollable}>↲    [original] line 278 (rest generated at line 142)                               
                                                                                                                                                      
            ╚╚╚╚•chapter.html;↲                                        [generated] line 143                                                           
                •chapter.html;↲                                        [generated] subset                                                             
                {chapter.html}↲                                                                                                                       
                {      chapter.html}↲                                                                                                                 
            ╚╚╚╚{@html•chapter.html}↲                                  [original] line 279 (rest generated at lines 144, 145)                         
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲                            [generated] line 144                                                                                                     
                        ↲                                                                                                                             
╚╚╚╚{@html•chapter.html}↲    [original] line 279 (rest generated at lines 143, 145)                                                                   
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                 { svelteHTML.createElement("div", { "class":`controls`,});                                                                           {/**
            ╚╚╚╚•{•svelteHTML.createElement("div",•{•"class":`controls`,});↲    [generated] line 145                                                  
            ╚╚╚╚                                                                [generated] subset                                                    
            ↲                                                                                                                                         
                                    ↲                                                                                                                 
            ╚╚╚╚{@html•chapter.html}↲                                           [original] line 279 (rest generated at lines 143, 144)                
                                                                                                                                                      
            ╚╚╚╚•{•svelteHTML.createElement("div",•{•"class":`controls`,});↲    [generated] line 145                                                  
                •{•svelteHTML.createElement("div",•{•"class":`controls`,});↲    [generated] subset                                                    
                <                            div    "c lass=  controls"    ↲                                                                          
                                                    #                           Order-breaking mappings                                               
                <div class="controls" ↲                                                                                                               
            ╚╚╚╚<div•class="controls">↲                                         [original] line 281 (rest generated at line 146)                      
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                    if(chapter.app_b){                                                                                                                {/**
               ╚╚╚╚╚if(chapter.app_b){↲       [generated] line 146                                                                                    
               ╚╚╚╚╚                          [generated] subset                                                                                      
               ↲                                                                                                                                      
                                         ↲                                                                                                            
               ╚╚╚╚<div•class="controls">↲    [original] line 281 (rest generated at line 145)                                                        
                                                                                                                                                      
               ╚╚╚╚╚if(chapter.app_b){↲       [generated] line 146                                                                                    
                    if(chapter.app_b){↲       [generated] subset                                                                                      
                    {  chapter.app_b} ↲                                                                                                               
                    {    chapter.app_b}↲                                                                                                              
               ╚╚╚╚╚{#if•chapter.app_b}↲      [original] line 282                                                                                     
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
                  ╚╚╚╚╚╚↲                                                               [generated] line 147                                          
                  ╚╚╚╚╚╚                                                                [generated] subset                                            
                  ╚╚╚╚╚╚                                                                                                                              
                  ╚╚╚╚╚╚<!--•TODO•disable•this•button•when•the•contents•of•the•REPL↲    [original] line 283                                           
                                                                                                                                                      
                  ╚╚╚╚╚╚↲                                                               [generated] line 147                                          
                        ↲                                                               [generated] subset                                            
                                                            ↲                                                                                         
                  ╚╚╚╚╚╚╚matches•the•expected•end•result•-->↲                           [original] line 284 (rest generated at line 148)              
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                          { svelteHTML.createElement("button", {   "class":`show`,"on:click":() => completed ? reset() : complete(),});               {/**
                  ╚╚╚╚╚╚••{•svelteHTML.createElement("button",•{•••"class":`show`,"on:click":()•=>•completed•?•reset()•:•complete(),});↲    [generated] line 148
                  ╚╚╚╚╚╚                                                                                                                    [generated] subset
                  ↲                                                                                                                                   
                                                            ↲                                                                                         
                  ╚╚╚╚╚╚╚matches•the•expected•end•result•-->↲                                                                               [original] line 284 (rest generated at line 147)
                                                                                                                                                      
                  ╚╚╚╚╚╚••{•svelteHTML.createElement("button",•{•••"class":`show`,"on:click":()•=>•completed•?•reset()•:•complete(),});↲    [generated] line 148
                        ••{•svelteHTML.createElement("button",•{•••"class":`show`,"on:click":()•=>•completed•?•reset()•:•complete(),});↲    [generated] subset
                        <>                            button    "•"c lass=  show" c    lick =()•=>•completed•?•reset()•:•complete()}   ↲              
                         #============================            #                                                                         Order-breaking mappings
                        <button class="show"•   click=" ()•=>•completed•?•reset()•:•complete()} >↲                                                    
                  ╚╚╚╚╚╚<button•class="show"•on:click="{()•=>•completed•?•reset()•:•complete()}">↲                                          [original] line 285 (rest generated at line 149)
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                            completed ? 'Reset' : 'Show me';                                                                                          {/**
                     ╚╚╚╚╚╚╚completed•?•'Reset'•:•'Show•me';↲                                            [generated] line 149                         
                     ╚╚╚╚╚╚╚                                                                             [generated] subset                           
                     ↲                                                                                                                                
                                                                                                    ↲                                                 
                     ╚╚╚╚╚╚<button•class="show"•on:click="{()•=>•completed•?•reset()•:•complete()}">↲    [original] line 285 (rest generated at line 148)
                                                                                                                                                      
                     ╚╚╚╚╚╚╚completed•?•'Reset'•:•'Show•me';↲                                            [generated] line 149                         
                            completed•?•'Reset'•:•'Show•me';↲                                            [generated] subset                           
                            completed•?•'Reset'•:•'Show•me'}↲                                                                                         
                             completed•?•'Reset'•:•'Show•me'}↲                                                                                        
                     ╚╚╚╚╚╚╚{completed•?•'Reset'•:•'Show•me'}↲                                           [original] line 286 (rest generated at line 150)
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                         }                                                                                                                            {/**
                  ╚╚╚╚╚╚•}↲                                    [generated] line 150                                                                   
                  ╚╚╚╚╚╚                                       [generated] subset                                                                     
                  ↲                                                                                                                                   
                                                          ↲                                                                                           
                  ╚╚╚╚╚╚╚{completed•?•'Reset'•:•'Show•me'}↲    [original] line 286 (rest generated at line 149)                                       
                                                                                                                                                      
                  ╚╚╚╚╚╚•}↲                                    [generated] line 150                                                                   
                        •}↲                                    [generated] subset                                                                     
                        / ↲                                                                                                                           
                         /       ↲                                                                                                                    
                  ╚╚╚╚╚╚</button>↲                             [original] line 287                                                                    
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                    }                                                                                                                                 {/**
               ╚╚╚╚╚}↲        [generated] line 151                                                                                                    
               ╚╚╚╚╚{↲                                                                                                                                
               ╚╚╚╚╚{    ↲                                                                                                                            
               ╚╚╚╚╚{/if}↲    [original] line 288 (rest generated at lines 152, 153)                                                                  
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲              [generated] line 152                                                                                                                   
          ↲                                                                                                                                           
╚╚╚╚╚{/if}↲    [original] line 288 (rest generated at lines 151, 153)                                                                                 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                    if(selected.next){                                                                                                                {/**
               ╚╚╚╚╚if(selected.next){↲     [generated] line 153                                                                                      
               ╚╚╚╚╚                        [generated] subset                                                                                        
               ↲                                                                                                                                      
                         ↲                                                                                                                            
               ╚╚╚╚╚{/if}↲                  [original] line 288 (rest generated at lines 151, 152)                                                    
                                                                                                                                                      
               ╚╚╚╚╚if(selected.next){↲     [generated] line 153                                                                                      
                    if(selected.next){↲     [generated] subset                                                                                        
                    {  selected.next} ↲                                                                                                               
                    {    selected.next}↲                                                                                                              
               ╚╚╚╚╚{#if•selected.next}↲    [original] line 290                                                                                       
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                         { svelteHTML.createElement("a", {   "class":`next`,"href":`tutorial/${selected.next.slug}`,});  }                            {/**
                  ╚╚╚╚╚╚•{•svelteHTML.createElement("a",•{•••"class":`next`,"href":`tutorial/${selected.next.slug}`,});••}↲    [generated] line 154   
                  ╚╚╚╚╚╚<                            a    "•"c lass=  next" h ref=  tutorial/ {selected.next.slug}"    N/ ↲                           
                                                            #                                                                  Order-breaking mappings
                  ╚╚╚╚╚╚<a class="next"•href="tutorial/{selected.next.slug}" N    /  ↲                                                                
                  ╚╚╚╚╚╚<a•class="next"•href="tutorial/{selected.next.slug}">Next</a>↲                                         [original] line 291    
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                    }                                                                                                                                 {/**
               ╚╚╚╚╚}↲        [generated] line 155                                                                                                    
               ╚╚╚╚╚{↲                                                                                                                                
               ╚╚╚╚╚{    ↲                                                                                                                            
               ╚╚╚╚╚{/if}↲    [original] line 292 (rest generated at line 156)                                                                        
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                 }                                                                                                                                    {/**
            ╚╚╚╚•}↲        [generated] line 156                                                                                                       
            ╚╚╚╚           [generated] subset                                                                                                         
            ↲                                                                                                                                         
                      ↲                                                                                                                               
            ╚╚╚╚╚{/if}↲    [original] line 292 (rest generated at line 155)                                                                           
                                                                                                                                                      
            ╚╚╚╚•}↲        [generated] line 156                                                                                                       
                •}↲        [generated] subset                                                                                                         
                / ↲                                                                                                                                   
                 /    ↲                                                                                                                               
            ╚╚╚╚</div>↲    [original] line 293 (rest generated at lines 157, 158)                                                                     
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲              [generated] line 157                                                                                                                   
          ↲                                                                                                                                           
╚╚╚╚</div>↲    [original] line 293 (rest generated at lines 156, 158)                                                                                 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                 { svelteHTML.createElement("div", { "class":`improve-chapter`,});                                                                    {/**
            ╚╚╚╚•{•svelteHTML.createElement("div",•{•"class":`improve-chapter`,});↲    [generated] line 158                                           
            ╚╚╚╚                                                                       [generated] subset                                             
            ↲                                                                                                                                         
                      ↲                                                                                                                               
            ╚╚╚╚</div>↲                                                                [original] line 293 (rest generated at lines 156, 157)         
                                                                                                                                                      
            ╚╚╚╚•{•svelteHTML.createElement("div",•{•"class":`improve-chapter`,});↲    [generated] line 158                                           
                •{•svelteHTML.createElement("div",•{•"class":`improve-chapter`,});↲    [generated] subset                                             
                <                            div    "c lass=  improve-chapter"    ↲                                                                   
                                                    #                                  Order-breaking mappings                                        
                <div class="improve-chapter" ↲                                                                                                        
            ╚╚╚╚<div•class="improve-chapter">↲                                         [original] line 295 (rest generated at line 159)               
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                     { svelteHTML.createElement("a", {   "class":`no-underline`,"href":improve_link,});   }                                           {/**
               ╚╚╚╚╚•{•svelteHTML.createElement("a",•{•••"class":`no-underline`,"href":improve_link,});•••}↲    [generated] line 159                  
               ╚╚╚╚╚                                                                                            [generated] subset                    
               ↲                                                                                                                                      
                                                ↲                                                                                                     
               ╚╚╚╚<div•class="improve-chapter">↲                                                               [original] line 295 (rest generated at line 158)
                                                                                                                                                      
               ╚╚╚╚╚•{•svelteHTML.createElement("a",•{•••"class":`no-underline`,"href":improve_link,});•••}↲    [generated] line 159                  
                    •{•svelteHTML.createElement("a",•{•••"class":`no-underline`,"href":improve_link,});•••}↲    [generated] subset                    
                    <                            a    "•{c lass=  no-underline" h ref= improve_link}   E / ↲                                          
                                                        #                                                       Order-breaking mappings               
                    <a class="no-underline"•href={improve_link} E                 /  ↲                                                                
               ╚╚╚╚╚<a•class="no-underline"•href={improve_link}>Edit•this•chapter</a>↲                          [original] line 296 (rest generated at line 160)
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                 }                                                                                                                                    {/**
            ╚╚╚╚•}↲                                                                    [generated] line 160                                           
            ╚╚╚╚                                                                       [generated] subset                                             
            ↲                                                                                                                                         
                                                                                  ↲                                                                   
            ╚╚╚╚╚<a•class="no-underline"•href={improve_link}>Edit•this•chapter</a>↲    [original] line 296 (rest generated at line 159)               
                                                                                                                                                      
            ╚╚╚╚•}↲                                                                    [generated] line 160                                           
                •}↲                                                                    [generated] subset                                             
                / ↲                                                                                                                                   
                 /    ↲                                                                                                                               
            ╚╚╚╚</div>↲                                                                [original] line 297 (rest generated at line 161)               
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
             }                                                                                                                                        {/**
         ╚╚╚•}↲         [generated] line 161                                                                                                          
         ╚╚╚            [generated] subset                                                                                                            
         ↲                                                                                                                                            
                   ↲                                                                                                                                  
         ╚╚╚╚</div>↲    [original] line 297 (rest generated at line 160)                                                                              
                                                                                                                                                      
         ╚╚╚•}↲         [generated] line 161                                                                                                          
            •}↲         [generated] subset                                                                                                            
            / ↲                                                                                                                                       
             /    ↲                                                                                                                                   
         ╚╚╚</div>↲     [original] line 298 (rest generated at line 162)                                                                              
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
         }                                                                                                                                            {/**
      ╚╚•}↲         [generated] line 162                                                                                                              
      ╚╚            [generated] subset                                                                                                                
      ↲                                                                                                                                               
               ↲                                                                                                                                      
      ╚╚╚</div>↲    [original] line 298 (rest generated at line 161)                                                                                  
                                                                                                                                                      
      ╚╚•}↲         [generated] line 162                                                                                                              
        •}↲         [generated] subset                                                                                                                
        / ↲                                                                                                                                           
         /    ↲                                                                                                                                       
      ╚╚</div>↲     [original] line 299 (rest generated at lines 163, 164)                                                                            
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲            [generated] line 163                                                                                                                     
        ↲                                                                                                                                             
╚╚</div>↲    [original] line 299 (rest generated at lines 162, 164)                                                                                   
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
         { svelteHTML.createElement("div", { "class":`tutorial-repl`,});                                                                              {/**
      ╚╚•{•svelteHTML.createElement("div",•{•"class":`tutorial-repl`,});↲    [generated] line 164                                                     
      ╚╚                                                                     [generated] subset                                                       
      ↲                                                                                                                                               
              ↲                                                                                                                                       
      ╚╚</div>↲                                                              [original] line 299 (rest generated at lines 162, 163)                   
                                                                                                                                                      
      ╚╚•{•svelteHTML.createElement("div",•{•"class":`tutorial-repl`,});↲    [generated] line 164                                                     
        •{•svelteHTML.createElement("div",•{•"class":`tutorial-repl`,});↲    [generated] subset                                                       
        <                            div    "c lass=  tutorial-repl"    ↲                                                                             
                                            #                                Order-breaking mappings                                                  
        <div class="tutorial-repl" ↲                                                                                                                  
      ╚╚<div•class="tutorial-repl">↲                                         [original] line 301 (rest generated at line 165)                         
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
             { const $$_lpeR3C = __sveltets_2_ensureComponent(Repl); const $$_lpeR3 = new $$_lpeR3C({ target: __sveltets_2_any(), props: {               "workersUrl":`workers`,svelteUrl,rollupUrl,"orientation":mobile ? 'columns' : 'rows',"fixed":mobile,"injectedJS":mapbox_setup,"relaxed":true,}});repl = $$_lpeR3;$$_lpeR3.$on("change", handle_change);}{/**
         ╚╚╚•{•const•$$_lpeR3C•=•__sveltets_2_ensureComponent(Repl);•const•$$_lpeR3•=•new•$$_lpeR3C({•target:•__sveltets_2_any(),•props:•{•••••••••••••••"workersUrl":`workers`,svelteUrl,rollupUrl,"orientation":mobile•?•'columns'•:•'rows',"fixed":mobile,"injectedJS":mapbox_setup,"relaxed":true,}});repl•=•$$_lpeR3;$$_lpeR3.$on("change",•handle_change);}↲    [generated] line 165
         ╚╚╚                                                                                                                                                                                                                                                                                                                                                          [generated] subset
         ↲                                                                                                                                                                                                                                                                                                                                                            
                                      ↲                                                                                                                                                                                                                                                                                                                               
         ╚╚<div•class="tutorial-repl">↲                                                                                                                                                                                                                                                                                                                               [original] line 301 (rest generated at line 164)
                                                                                                                                                                                                                                                                                                                                                                      
         ╚╚╚•{•const•$$_lpeR3C•=•__sveltets_2_ensureComponent(Repl);•const•$$_lpeR3•=•new•$$_lpeR3C({•target:•__sveltets_2_any(),•props:•{•••••••••••••••"workersUrl":`workers`,svelteUrl,rollupUrl,"orientation":mobile•?•'columns'•:•'rows',"fixed":mobile,"injectedJS":mapbox_setup,"relaxed":true,}});repl•=•$$_lpeR3;$$_lpeR3.$on("change",•handle_change);}↲    [generated] line 165
            •{•const•$$_lpeR3C•=•__sveltets_2_ensureComponent(Repl);•const•$$_lpeR3•=•new•$$_lpeR3C({•target:•__sveltets_2_any(),•props:•{                                                                                                                                                                                                                            [generated] subset
            <                                                 Repl                                                                                                                                                                                                                                                                                                    
            <Repl                                                                                                                                                                                                                                                                                                                                                     
         ╚╚╚<Repl↲                                                                                                                                                                                                                                                                                                                                                    [original] line 302 
                                                                                                                                                                                                                                                                                                                                                                      
         ╚╚╚•{•const•$$_lpeR3C•=•__sveltets_2_ensureComponent(Repl);•const•$$_lpeR3•=•new•$$_lpeR3C({•target:•__sveltets_2_any(),•props:•{•••••••••••••••"workersUrl":`workers`,svelteUrl,rollupUrl,"orientation":mobile•?•'columns'•:•'rows',"fixed":mobile,"injectedJS":mapbox_setup,"relaxed":true,}});repl•=•$$_lpeR3;$$_lpeR3.$on("change",•handle_change);}↲    [generated] line 165
                                                                                                                                          ••                                                                                                                                                              repl•=•$$_lpeR3;$$_lpeR3.$on(                               [generated] subset
                                                                                                                                          ╚↲                                                                                                                                                              repl}                                                       
                                                                                                                                           #==============================================================================================================================================================                                                            Order-breaking mappings
          ╚             repl}↲                                                                                                                                                                                                                                                                                                                                        
         ╚╚╚╚bind:this={repl}↲                                                                                                                                                                                                                                                                                                                                        [original] line 303 
                                                                                                                                                                                                                                                                                                                                                                      
         ╚╚╚•{•const•$$_lpeR3C•=•__sveltets_2_ensureComponent(Repl);•const•$$_lpeR3•=•new•$$_lpeR3C({•target:•__sveltets_2_any(),•props:•{•••••••••••••••"workersUrl":`workers`,svelteUrl,rollupUrl,"orientation":mobile•?•'columns'•:•'rows',"fixed":mobile,"injectedJS":mapbox_setup,"relaxed":true,}});repl•=•$$_lpeR3;$$_lpeR3.$on("change",•handle_change);}↲    [generated] line 165
                                                                                                                                            ••           "workersUrl":`workers`,                                                                                                                                                                                      [generated] subset
                                                                                                                                            "↲           w orkersUrl=  workers"                                                                                                                                                                                       
                                                                                                                                             #===========                                                                                                                                                                                                             Order-breaking mappings
             workersUrl="workers"↲                                                                                                                                                                                                                                                                                                                                    
         ╚╚╚╚workersUrl="workers"↲                                                                                                                                                                                                                                                                                                                                    [original] line 304 
                                                                                                                                                                                                                                                                                                                                                                      
         ╚╚╚•{•const•$$_lpeR3C•=•__sveltets_2_ensureComponent(Repl);•const•$$_lpeR3•=•new•$$_lpeR3C({•target:•__sveltets_2_any(),•props:•{•••••••••••••••"workersUrl":`workers`,svelteUrl,rollupUrl,"orientation":mobile•?•'columns'•:•'rows',"fixed":mobile,"injectedJS":mapbox_setup,"relaxed":true,}});repl•=•$$_lpeR3;$$_lpeR3.$on("change",•handle_change);}↲    [generated] line 165
                                                                                                                                              •                                 svelteUrl,                                                                                                                                                                            [generated] subset
                                                                                                                                              ↲                                 svelteUrl}                                                                                                                                                                            
                                                                                                                                              #=================================                                                                                                                                                                                      Order-breaking mappings
              svelteUrl}↲                                                                                                                                                                                                                                                                                                                                             
         ╚╚╚╚{svelteUrl}↲                                                                                                                                                                                                                                                                                                                                             [original] line 305 
                                                                                                                                                                                                                                                                                                                                                                      
         ╚╚╚•{•const•$$_lpeR3C•=•__sveltets_2_ensureComponent(Repl);•const•$$_lpeR3•=•new•$$_lpeR3C({•target:•__sveltets_2_any(),•props:•{•••••••••••••••"workersUrl":`workers`,svelteUrl,rollupUrl,"orientation":mobile•?•'columns'•:•'rows',"fixed":mobile,"injectedJS":mapbox_setup,"relaxed":true,}});repl•=•$$_lpeR3;$$_lpeR3.$on("change",•handle_change);}↲    [generated] line 165
                                                                                                                                               •                                          rollupUrl,                                                                                                                                                                  [generated] subset
                                                                                                                                               ↲                                          rollupUrl}                                                                                                                                                                  
                                                                                                                                               #==========================================                                                                                                                                                                            Order-breaking mappings
              rollupUrl}↲                                                                                                                                                                                                                                                                                                                                             
         ╚╚╚╚{rollupUrl}↲                                                                                                                                                                                                                                                                                                                                             [original] line 306 
                                                                                                                                                                                                                                                                                                                                                                      
         ╚╚╚•{•const•$$_lpeR3C•=•__sveltets_2_ensureComponent(Repl);•const•$$_lpeR3•=•new•$$_lpeR3C({•target:•__sveltets_2_any(),•props:•{•••••••••••••••"workersUrl":`workers`,svelteUrl,rollupUrl,"orientation":mobile•?•'columns'•:•'rows',"fixed":mobile,"injectedJS":mapbox_setup,"relaxed":true,}});repl•=•$$_lpeR3;$$_lpeR3.$on("change",•handle_change);}↲    [generated] line 165
                                                                                                                                                ••                                                  "orientation":mobile•?•'columns'•:•'rows',                                                                                                                        [generated] subset
                                                                                                                                                {↲                                                  o rientation= mobile•?•'columns'•:•'rows'}                                                                                                                        
                                                                                                                                                 #==================================================                                                                                                                                                                  Order-breaking mappings
             orientation={mobile•?•'columns'•:•'rows'}↲                                                                                                                                                                                                                                                                                                               
         ╚╚╚╚orientation={mobile•?•'columns'•:•'rows'}↲                                                                                                                                                                                                                                                                                                               [original] line 307 
                                                                                                                                                                                                                                                                                                                                                                      
         ╚╚╚•{•const•$$_lpeR3C•=•__sveltets_2_ensureComponent(Repl);•const•$$_lpeR3•=•new•$$_lpeR3C({•target:•__sveltets_2_any(),•props:•{•••••••••••••••"workersUrl":`workers`,svelteUrl,rollupUrl,"orientation":mobile•?•'columns'•:•'rows',"fixed":mobile,"injectedJS":mapbox_setup,"relaxed":true,}});repl•=•$$_lpeR3;$$_lpeR3.$on("change",•handle_change);}↲    [generated] line 165
                                                                                                                                                  ••                                                                                          "fixed":mobile,                                                                                                         [generated] subset
                                                                                                                                                  {↲                                                                                          f ixed= mobile}                                                                                                         
                                                                                                                                                   #==========================================================================================                                                                                                                        Order-breaking mappings
             fixed={mobile}↲                                                                                                                                                                                                                                                                                                                                          
         ╚╚╚╚fixed={mobile}↲                                                                                                                                                                                                                                                                                                                                          [original] line 308 
                                                                                                                                                                                                                                                                                                                                                                      
         ╚╚╚•{•const•$$_lpeR3C•=•__sveltets_2_ensureComponent(Repl);•const•$$_lpeR3•=•new•$$_lpeR3C({•target:•__sveltets_2_any(),•props:•{•••••••••••••••"workersUrl":`workers`,svelteUrl,rollupUrl,"orientation":mobile•?•'columns'•:•'rows',"fixed":mobile,"injectedJS":mapbox_setup,"relaxed":true,}});repl•=•$$_lpeR3;$$_lpeR3.$on("change",•handle_change);}↲    [generated] line 165
                                                                                                                                                    ••                                                                                                                                                                                 "change",•handle_change);}     [generated] subset
                                                                                                                                                    {↲                                                                                                                                                                                 c hange = handle_change}       
                                                                                                                                                     #=================================================================================================================================================================================                               Order-breaking mappings
                change={handle_change}↲                                                                                                                                                                                                                                                                                                                               
         ╚╚╚╚on:change={handle_change}↲                                                                                                                                                                                                                                                                                                                               [original] line 309 
                                                                                                                                                                                                                                                                                                                                                                      
         ╚╚╚•{•const•$$_lpeR3C•=•__sveltets_2_ensureComponent(Repl);•const•$$_lpeR3•=•new•$$_lpeR3C({•target:•__sveltets_2_any(),•props:•{•••••••••••••••"workersUrl":`workers`,svelteUrl,rollupUrl,"orientation":mobile•?•'columns'•:•'rows',"fixed":mobile,"injectedJS":mapbox_setup,"relaxed":true,}});repl•=•$$_lpeR3;$$_lpeR3.$on("change",•handle_change);}↲    [generated] line 165
                                                                                                                                                      ••                                                                                                     "injectedJS":mapbox_setup,                                                                               [generated] subset
                                                                                                                                                      {↲                                                                                                     i njectedJS= mapbox_setup}                                                                               
                                                                                                                                                       #=====================================================================================================                                                                                                         Order-breaking mappings
             injectedJS={mapbox_setup}↲                                                                                                                                                                                                                                                                                                                               
         ╚╚╚╚injectedJS={mapbox_setup}↲                                                                                                                                                                                                                                                                                                                               [original] line 310 
                                                                                                                                                                                                                                                                                                                                                                      
         ╚╚╚•{•const•$$_lpeR3C•=•__sveltets_2_ensureComponent(Repl);•const•$$_lpeR3•=•new•$$_lpeR3C({•target:•__sveltets_2_any(),•props:•{•••••••••••••••"workersUrl":`workers`,svelteUrl,rollupUrl,"orientation":mobile•?•'columns'•:•'rows',"fixed":mobile,"injectedJS":mapbox_setup,"relaxed":true,}});repl•=•$$_lpeR3;$$_lpeR3.$on("change",•handle_change);}↲    [generated] line 165
                                                                                                                                                                                                                                                                                       "relaxed":true,}});                                                            [generated] subset
                                                                                                                                                                                                                                                                                       r elaxed↲                                                                      
             relaxed↲                                                                                                                                                                                                                                                                                                                                                 
         ╚╚╚╚relaxed↲                                                                                                                                                                                                                                                                                                                                                 [original] line 311 
                                                                                                                                                                                                                                                                                                                                                                      
         ╚╚╚•{•const•$$_lpeR3C•=•__sveltets_2_ensureComponent(Repl);•const•$$_lpeR3•=•new•$$_lpeR3C({•target:•__sveltets_2_any(),•props:•{•••••••••••••••"workersUrl":`workers`,svelteUrl,rollupUrl,"orientation":mobile•?•'columns'•:•'rows',"fixed":mobile,"injectedJS":mapbox_setup,"relaxed":true,}});repl•=•$$_lpeR3;$$_lpeR3.$on("change",•handle_change);}↲    [generated] line 165
                                                                                                                                                        •                                                                                                                                                                                                        ↲    [generated] subset
                                                                                                                                                        ╚                                                                                                                                                                                                        ↲    
          ╚   ↲                                                                                                                                                                                                                                                                                                                                                       
         ╚╚╚/>↲                                                                                                                                                                                                                                                                                                                                                       [original] line 312 (rest generated at line 166)
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
         }                                                                                                                                            {/**
      ╚╚•}↲        [generated] line 166                                                                                                               
      ╚╚           [generated] subset                                                                                                                 
      ↲                                                                                                                                               
           ↲                                                                                                                                          
      ╚╚╚/>↲       [original] line 312 (rest generated at line 165)                                                                                   
                                                                                                                                                      
      ╚╚•}↲        [generated] line 166                                                                                                               
        •}↲        [generated] subset                                                                                                                 
        / ↲                                                                                                                                           
         /    ↲                                                                                                                                       
      ╚╚</div>↲    [original] line 313 (rest generated at line 167)                                                                                   
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     }                                                                                                                                                {/**
   ╚•}↲         [generated] line 167                                                                                                                  
   ╚            [generated] subset                                                                                                                    
   ↲                                                                                                                                                  
           ↲                                                                                                                                          
   ╚╚</div>↲    [original] line 313 (rest generated at line 166)                                                                                      
                                                                                                                                                      
   ╚•}↲         [generated] line 167                                                                                                                  
    •}↲         [generated] subset                                                                                                                    
    / ↲                                                                                                                                               
     /    ↲                                                                                                                                           
   ╚</div>↲     [original] line 314 (rest generated at lines 168, 169)                                                                                
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲           [generated] line 168                                                                                                                      
       ↲                                                                                                                                              
╚</div>↲    [original] line 314 (rest generated at lines 167, 169)                                                                                    
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    if(mobile){                                                                                                                                       {/**
   ╚if(mobile){↲     [generated] line 169                                                                                                             
   ╚                 [generated] subset                                                                                                               
   ↲                                                                                                                                                  
          ↲                                                                                                                                           
   ╚</div>↲          [original] line 314 (rest generated at lines 167, 168)                                                                           
                                                                                                                                                      
   ╚if(mobile){↲     [generated] line 169                                                                                                             
    if(mobile){↲     [generated] subset                                                                                                               
    {  mobile} ↲                                                                                                                                      
    {    mobile}↲                                                                                                                                     
   ╚{#if•mobile}↲    [original] line 316                                                                                                              
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
          { const $$_elggoTneercS1C = __sveltets_2_ensureComponent(ScreenToggle); new $$_elggoTneercS1C({ target: __sveltets_2_any(), props: {  offset,"labels":['tutorial', 'input', 'output'],}});/*Ωignore_startΩ*/() => offset = __sveltets_2_any(null);/*Ωignore_endΩ*/}{/**
      ╚╚••{•const•$$_elggoTneercS1C•=•__sveltets_2_ensureComponent(ScreenToggle);•new•$$_elggoTneercS1C({•target:•__sveltets_2_any(),•props:•{••offset,"labels":['tutorial',•'input',•'output'],}});/*Ωignore_startΩ*/()•=>•offset•=•__sveltets_2_any(null);/*Ωignore_endΩ*/}↲    [generated] line 170
      ╚╚<>                                                         ScreenToggle                                                               i{offset•l abels= ['tutorial',•'input',•'output']}                                                                             ↲    
         #=========================================================                                                                            #                                                                                                                                  Order-breaking mappings
      ╚╚<ScreenToggle  i   offset•labels={['tutorial',•'input',•'output']} >↲                                                                                                                                                                                                     
      ╚╚<ScreenToggle•bind:offset•labels={['tutorial',•'input',•'output']}/>↲                                                                                                                                                                                                     [original] line 317 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    }                                                                                                                                                 {/**
   ╚}↲        [generated] line 171                                                                                                                    
   ╚{↲                                                                                                                                                
   ╚{    ↲                                                                                                                                            
   ╚{/if}↲    [original] line 318                                                                                                                     
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
 }};                                                                                                                                                  {/**
•}};↲     [generated] line 172                                                                                                                        
/                                                                                                                                                     
 /                                                                                                                                                    
</div>    [original] line 319                                                                                                                         
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
return { props: {slug: slug , chapter: chapter}, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}