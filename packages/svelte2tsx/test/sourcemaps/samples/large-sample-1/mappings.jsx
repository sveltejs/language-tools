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
</script>↲    [original] line 14 (rest generated at line 119)                                                                                         
                                                                                                                                                      
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
</script>↲    [original] line 109 (rest generated at line 121)                                                                                        
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
async () => {                                                                                                                                         {/**
============#     Originless mappings                                                                                                                 
async•()•=>•{↲    [generated] line 119                                                                                                                
             ↲                                                                                                                                        
         ↲                                                                                                                                            
</script>↲        [original] line 14 (rest generated at line 15)                                                                                      
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**

------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲             [generated] line 121                                                                                                                    
         ↲                                                                                                                                            
</script>↲    [original] line 109 (rest generated at line 118)                                                                                        
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**

------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲            [generated] line 123                                                                                                                     
        ↲                                                                                                                                             
</style>↲    [original] line 259                                                                                                                      
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**

------------------------------------------------------------------------------------------------------------------------------------------------------ */}
 { svelteHTML.createElement("svelte:head", {});                                                                                                       {/**
•{•svelteHTML.createElement("svelte:head",•{});↲    [generated] line 125                                                                              
s                                              ↲                                                                                                      
 s           ↲                                                                                                                                        
<svelte:head>↲                                      [original] line 261                                                                               
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     { svelteHTML.createElement("title", {});selected.section.title;  selected.chapter.title;    }                                                    {/**
   #                                                                                                   Originless mappings                            
   ╚•{•svelteHTML.createElement("title",•{});selected.section.title;••selected.chapter.title;••••}↲    [generated] line 126                           
    <                            title       selected.section.title}• selected.chapter.title}•  / ↲                                                   
    <title  selected.section.title}•   selected.chapter.title}•                  /      ↲                                                             
   ╚<title>{selected.section.title}•/•{selected.chapter.title}•••Svelte•Tutorial</title>↲              [original] line 262                            
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**

------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     { svelteHTML.createElement("meta", {   "name":`twitter:title`,"content":`Svelte tutorial`,});}                                                   {/**
   #                                                                                                    Originless mappings                           
   ╚•{•svelteHTML.createElement("meta",•{•••"name":`twitter:title`,"content":`Svelte•tutorial`,});}↲    [generated] line 128                          
    <                            meta    "•"n ame=  twitter:title" c ontent=  Svelte•tutorial"     ↲                                                  
                                           #                                                            Order-breaking mappings                       
    <meta name="twitter:title"•content="Svelte•tutorial" ↲                                                                                            
   ╚<meta•name="twitter:title"•content="Svelte•tutorial">↲                                              [original] line 264                           
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     { svelteHTML.createElement("meta", {   "name":`twitter:description`,"content":`${selected.section.title} / ${selected.chapter.title}`,});}       {/**
   #                                                                                                                                                Originless mappings
   ╚•{•svelteHTML.createElement("meta",•{•••"name":`twitter:description`,"content":`${selected.section.title}•/•${selected.chapter.title}`,});}↲    [generated] line 129
    <                            meta    "•"n ame=  twitter:description" c ontent=   {selected.section.title}•/• {selected.chapter.title}"     ↲      
                                           #                                                                                                        Order-breaking mappings
    <meta name="twitter:description"•content="{selected.section.title}•/•{selected.chapter.title}" ↲                                                  
   ╚<meta•name="twitter:description"•content="{selected.section.title}•/•{selected.chapter.title}">↲                                                [original] line 265 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     { svelteHTML.createElement("meta", {   "name":`Description`,"content":`${selected.section.title} / ${selected.chapter.title}`,});}               {/**
   #                                                                                                                                        Originless mappings
   ╚•{•svelteHTML.createElement("meta",•{•••"name":`Description`,"content":`${selected.section.title}•/•${selected.chapter.title}`,});}↲    [generated] line 130
    <                            meta    "•"n ame=  Description" c ontent=   {selected.section.title}•/• {selected.chapter.title}"     ↲              
                                           #                                                                                                Order-breaking mappings
    <meta name="Description"•content="{selected.section.title}•/•{selected.chapter.title}" ↲                                                          
   ╚<meta•name="Description"•content="{selected.section.title}•/•{selected.chapter.title}">↲                                                [original] line 266 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
 }                                                                                                                                                    {/**
•}↲                [generated] line 131                                                                                                               
/ ↲                                                                                                                                                   
 /            ↲                                                                                                                                       
</svelte:head>↲    [original] line 267                                                                                                                
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**

------------------------------------------------------------------------------------------------------------------------------------------------------ */}
  { svelteHTML.createElement("svelte:window", { "bind:innerWidth":width,});/*Ωignore_startΩ*/() => width = __sveltets_2_any(null);/*Ωignore_endΩ*/}   {/**
••{•svelteHTML.createElement("svelte:window",•{•"bind:innerWidth":width,});/*Ωignore_startΩ*/()•=>•width•=•__sveltets_2_any(null);/*Ωignore_endΩ*/}↲    [generated] line 133
<>                                             ib                 width}                                                                           ↲    
 #=============================================#                                                                                                        Order-breaking mappings
<              bi               width} >↲                                                                                                               
<svelte:window•bind:innerWidth={width}/>↲                                                                                                               [original] line 269 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**

------------------------------------------------------------------------------------------------------------------------------------------------------ */}
 { svelteHTML.createElement("div", { "class":`tutorial-outer`,});                                                                                     {/**
•{•svelteHTML.createElement("div",•{•"class":`tutorial-outer`,});↲    [generated] line 135                                                            
<                            div    "c lass=  tutorial-outer"    ↲                                                                                    
                                    #                                 Order-breaking mappings                                                         
<div class="tutorial-outer" ↲                                                                                                                         
<div•class="tutorial-outer">↲                                         [original] line 271                                                             
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     { svelteHTML.createElement("div", { "class":`viewport offset-${offset}`,});                                                                      {/**
   #                                                                                 Originless mappings                                              
   ╚•{•svelteHTML.createElement("div",•{•"class":`viewport•offset-${offset}`,});↲    [generated] line 136                                             
    <                            div    "c lass=  viewport•offset- {offset}"    ↲                                                                     
                                        #                                            Order-breaking mappings                                          
    <div class="viewport•offset-{offset}" ↲                                                                                                           
   ╚<div•class="viewport•offset-{offset}">↲                                          [original] line 272                                              
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
         { svelteHTML.createElement("div", { "class":`tutorial-text`,});                                                                              {/**
      =#                                                                     Originless mappings                                                      
      ╚╚•{•svelteHTML.createElement("div",•{•"class":`tutorial-text`,});↲    [generated] line 137                                                     
        <                            div    "c lass=  tutorial-text"    ↲                                                                             
                                            #                                Order-breaking mappings                                                  
        <div class="tutorial-text" ↲                                                                                                                  
      ╚╚<div•class="tutorial-text">↲                                         [original] line 273                                                      
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
             { svelteHTML.createElement("div", { "class":`table-of-contents`,});                                                                      {/**
         ==#                                                                         Originless mappings                                              
         ╚╚╚•{•svelteHTML.createElement("div",•{•"class":`table-of-contents`,});↲    [generated] line 138                                             
            <                            div    "c lass=  table-of-contents"    ↲                                                                     
                                                #                                    Order-breaking mappings                                          
            <div class="table-of-contents" ↲                                                                                                          
         ╚╚╚<div•class="table-of-contents">↲                                         [original] line 274                                              
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                  { const $$_stnetnoCfOelbaT4C = __sveltets_2_ensureComponent(TableOfContents); new $$_stnetnoCfOelbaT4C({ target: __sveltets_2_any(), props: {  sections,slug,selected,}});}{/**
            ===#                                                                                                                                                                                  Originless mappings
            ╚╚╚╚••{•const•$$_stnetnoCfOelbaT4C•=•__sveltets_2_ensureComponent(TableOfContents);•new•$$_stnetnoCfOelbaT4C({•target:•__sveltets_2_any(),•props:•{••sections,slug,selected,}});}↲    [generated] line 139
                <>                                                            TableOfContents                                                                  ••sections}slug}selected}     ↲    
                 #============================================================                                                                                  #                                 Order-breaking mappings
                <TableOfContents  sections}• slug}• selected} >↲                                                                                                                                  
            ╚╚╚╚<TableOfContents•{sections}•{slug}•{selected}/>↲                                                                                                                                  [original] line 275 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
             }                                                                                                                                        {/**
         ==#           Originless mappings                                                                                                            
         ╚╚╚•}↲        [generated] line 140                                                                                                           
            / ↲                                                                                                                                       
             /    ↲                                                                                                                                   
         ╚╚╚</div>↲    [original] line 276                                                                                                            
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**

------------------------------------------------------------------------------------------------------------------------------------------------------ */}
             { const $$_div3 = svelteHTML.createElement("div", {  "class":`chapter-markup`,});scrollable = $$_div3;                                   {/**
         ==#                                                                                                            Originless mappings           
         ╚╚╚•{•const•$$_div3•=•svelteHTML.createElement("div",•{••"class":`chapter-markup`,});scrollable•=•$$_div3;↲    [generated] line 142          
            <                                            div    "•c lass=  chapter-markup"    scrollable}          ↲                                  
                                                                 #                                                      Order-breaking mappings       
            <div class="chapter-markup"•           scrollable} ↲                                                                                      
         ╚╚╚<div•class="chapter-markup"•bind:this={scrollable}>↲                                                        [original] line 278           
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                 chapter.html;                                                                                                                        {/**
            ===#                         Originless mappings                                                                                          
            ╚╚╚╚•chapter.html;↲          [generated] line 143                                                                                         
                {chapter.html}↲                                                                                                                       
                {      chapter.html}↲                                                                                                                 
            ╚╚╚╚{@html•chapter.html}↲    [original] line 279                                                                                          
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**

------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                 { svelteHTML.createElement("div", { "class":`controls`,});                                                                           {/**
            ===#                                                                Originless mappings                                                   
            ╚╚╚╚•{•svelteHTML.createElement("div",•{•"class":`controls`,});↲    [generated] line 145                                                  
                <                            div    "c lass=  controls"    ↲                                                                          
                                                    #                           Order-breaking mappings                                               
                <div class="controls" ↲                                                                                                               
            ╚╚╚╚<div•class="controls">↲                                         [original] line 281                                                   
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                    if(chapter.app_b){                                                                                                                {/**
               ====#                        Originless mappings                                                                                       
               ╚╚╚╚╚if(chapter.app_b){↲     [generated] line 146                                                                                      
                    {  chapter.app_b} ↲                                                                                                               
                    {    chapter.app_b}↲                                                                                                              
               ╚╚╚╚╚{#if•chapter.app_b}↲    [original] line 282                                                                                       
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
                  ╚╚╚╚╚╚↲                                                               [generated] line 147                                          
                  ╚╚╚╚╚╚                                                                [generated] subset                                            
                  ╚╚╚╚╚╚                                                                                                                              
                  ╚╚╚╚╚╚<!--•TODO•disable•this•button•when•the•contents•of•the•REPL↲    [original] line 283                                           
                                                                                                                                                      
                  ╚╚╚╚╚╚↲                                                               [generated] line 147                                          
                        ↲                                                               [generated] subset                                            
                                                            ↲                                                                                         
                  ╚╚╚╚╚╚╚matches•the•expected•end•result•-->↲                           [original] line 284                                           
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                          { svelteHTML.createElement("button", {   "class":`show`,"on:click":() => completed ? reset() : complete(),});               {/**
                  =====#                                                                                                                    Originless mappings
                  ╚╚╚╚╚╚••{•svelteHTML.createElement("button",•{•••"class":`show`,"on:click":()•=>•completed•?•reset()•:•complete(),});↲    [generated] line 148
                        <>                            button    "•"c lass=  show" c    lick =()•=>•completed•?•reset()•:•complete()}   ↲              
                         #============================            #                                                                         Order-breaking mappings
                        <button class="show"•   click=" ()•=>•completed•?•reset()•:•complete()} >↲                                                    
                  ╚╚╚╚╚╚<button•class="show"•on:click="{()•=>•completed•?•reset()•:•complete()}">↲                                          [original] line 285 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                            completed ? 'Reset' : 'Show me';                                                                                          {/**
                     ======#                                      Originless mappings                                                                 
                     ╚╚╚╚╚╚╚completed•?•'Reset'•:•'Show•me';↲     [generated] line 149                                                                
                            completed•?•'Reset'•:•'Show•me'}↲                                                                                         
                             completed•?•'Reset'•:•'Show•me'}↲                                                                                        
                     ╚╚╚╚╚╚╚{completed•?•'Reset'•:•'Show•me'}↲    [original] line 286                                                                 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                         }                                                                                                                            {/**
                  =====#              Originless mappings                                                                                             
                  ╚╚╚╚╚╚•}↲           [generated] line 150                                                                                            
                        / ↲                                                                                                                           
                         /       ↲                                                                                                                    
                  ╚╚╚╚╚╚</button>↲    [original] line 287                                                                                             
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                    }                                                                                                                                 {/**
               ╚╚╚╚╚}↲        [generated] line 151                                                                                                    
               ╚╚╚╚╚{↲                                                                                                                                
               ╚╚╚╚╚{    ↲                                                                                                                            
               ╚╚╚╚╚{/if}↲    [original] line 288                                                                                                     
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**

------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                    if(selected.next){                                                                                                                {/**
               ====#                        Originless mappings                                                                                       
               ╚╚╚╚╚if(selected.next){↲     [generated] line 153                                                                                      
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
               ╚╚╚╚╚{/if}↲    [original] line 292                                                                                                     
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                 }                                                                                                                                    {/**
            ===#           Originless mappings                                                                                                        
            ╚╚╚╚•}↲        [generated] line 156                                                                                                       
                / ↲                                                                                                                                   
                 /    ↲                                                                                                                               
            ╚╚╚╚</div>↲    [original] line 293                                                                                                        
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**

------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                 { svelteHTML.createElement("div", { "class":`improve-chapter`,});                                                                    {/**
            ===#                                                                       Originless mappings                                            
            ╚╚╚╚•{•svelteHTML.createElement("div",•{•"class":`improve-chapter`,});↲    [generated] line 158                                           
                <                            div    "c lass=  improve-chapter"    ↲                                                                   
                                                    #                                  Order-breaking mappings                                        
                <div class="improve-chapter" ↲                                                                                                        
            ╚╚╚╚<div•class="improve-chapter">↲                                         [original] line 295                                            
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                     { svelteHTML.createElement("a", {   "class":`no-underline`,"href":improve_link,});   }                                           {/**
               ====#                                                                                            Originless mappings                   
               ╚╚╚╚╚•{•svelteHTML.createElement("a",•{•••"class":`no-underline`,"href":improve_link,});•••}↲    [generated] line 159                  
                    <                            a    "•{c lass=  no-underline" h ref= improve_link}   E / ↲                                          
                                                        #                                                       Order-breaking mappings               
                    <a class="no-underline"•href={improve_link} E                 /  ↲                                                                
               ╚╚╚╚╚<a•class="no-underline"•href={improve_link}>Edit•this•chapter</a>↲                          [original] line 296                   
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                 }                                                                                                                                    {/**
            ===#           Originless mappings                                                                                                        
            ╚╚╚╚•}↲        [generated] line 160                                                                                                       
                / ↲                                                                                                                                   
                 /    ↲                                                                                                                               
            ╚╚╚╚</div>↲    [original] line 297                                                                                                        
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
             }                                                                                                                                        {/**
         ==#           Originless mappings                                                                                                            
         ╚╚╚•}↲        [generated] line 161                                                                                                           
            / ↲                                                                                                                                       
             /    ↲                                                                                                                                   
         ╚╚╚</div>↲    [original] line 298                                                                                                            
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
         }                                                                                                                                            {/**
      =#           Originless mappings                                                                                                                
      ╚╚•}↲        [generated] line 162                                                                                                               
        / ↲                                                                                                                                           
         /    ↲                                                                                                                                       
      ╚╚</div>↲    [original] line 299                                                                                                                
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**

------------------------------------------------------------------------------------------------------------------------------------------------------ */}
         { svelteHTML.createElement("div", { "class":`tutorial-repl`,});                                                                              {/**
      =#                                                                     Originless mappings                                                      
      ╚╚•{•svelteHTML.createElement("div",•{•"class":`tutorial-repl`,});↲    [generated] line 164                                                     
        <                            div    "c lass=  tutorial-repl"    ↲                                                                             
                                            #                                Order-breaking mappings                                                  
        <div class="tutorial-repl" ↲                                                                                                                  
      ╚╚<div•class="tutorial-repl">↲                                         [original] line 301                                                      
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
             { const $$_lpeR3C = __sveltets_2_ensureComponent(Repl); const $$_lpeR3 = new $$_lpeR3C({ target: __sveltets_2_any(), props: {               "workersUrl":`workers`,svelteUrl,rollupUrl,"orientation":mobile ? 'columns' : 'rows',"fixed":mobile,"injectedJS":mapbox_setup,"relaxed":true,}});repl = $$_lpeR3;$$_lpeR3.$on("change", handle_change);}{/**
         ==#                                                                                                                                                                                                                                                                                                                                                          Originless mappings
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
         ╚╚╚/>↲                                                                                                                                                                                                                                                                                                                                                       [original] line 312 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
         }                                                                                                                                            {/**
      =#           Originless mappings                                                                                                                
      ╚╚•}↲        [generated] line 166                                                                                                               
        / ↲                                                                                                                                           
         /    ↲                                                                                                                                       
      ╚╚</div>↲    [original] line 313                                                                                                                
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     }                                                                                                                                                {/**
   #           Originless mappings                                                                                                                    
   ╚•}↲        [generated] line 167                                                                                                                   
    / ↲                                                                                                                                               
     /    ↲                                                                                                                                           
   ╚</div>↲    [original] line 314                                                                                                                    
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**

------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    if(mobile){                                                                                                                                       {/**
   #                 Originless mappings                                                                                                              
   ╚if(mobile){↲     [generated] line 169                                                                                                             
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