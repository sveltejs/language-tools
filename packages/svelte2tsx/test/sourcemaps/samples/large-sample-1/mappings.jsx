///<reference types="svelte" />
//----------------------------------------------------------------------------------------------------------------------------------------------------
<></>;                                                                                                                                                {/**
=#                            Originless mappings                                                                                                     
<></>;↲                       [generated] line 2                                                                                                      
  <   ↲                                                                                                                                               
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
;<></>;                                                                                                                                               {/**
;<></>;↲      [generated] line 15                                                                                                                     
;<>           [generated] subset                                                                                                                      
<                                                                                                                                                     
</script>↲    [original] line 14 (rest generated at line 119)                                                                                         
                                                                                                                                                      
;<></>;↲      [generated] line 15                                                                                                                     
   </>;↲      [generated] subset                                                                                                                      
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
     let slug/*Ωignore_startΩ*/;slug = __sveltets_1_any(slug);/*Ωignore_endΩ*/;                                                                       {/**
   ╚•let•slug/*Ωignore_startΩ*/;slug•=•__sveltets_1_any(slug);/*Ωignore_endΩ*/;↲    [generated] line 38                                               
   ╚•let•slug;                                                                 ↲                                                                      
   ╚      •let•slug;↲                                                                                                                                 
   ╚export•let•slug;↲                                                               [original] line 29                                                
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     let chapter/*Ωignore_startΩ*/;chapter = __sveltets_1_any(chapter);/*Ωignore_endΩ*/;                                                              {/**
   ╚•let•chapter/*Ωignore_startΩ*/;chapter•=•__sveltets_1_any(chapter);/*Ωignore_endΩ*/;↲    [generated] line 39                                      
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
    let  selected = __sveltets_1_invalidate(() => lookup.get(slug));                                                                                  {/**
   ╚let••selected•=•__sveltets_1_invalidate(()•=>•lookup.get(slug));↲    [generated] line 76                                                          
   ╚    •selected•=•                              lookup.get(slug); ↲                                                                                 
   ╚  •selected•=•lookup.get(slug);↲                                                                                                                  
   ╚$:•selected•=•lookup.get(slug);↲                                     [original] line 67                                                           
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    let  improve_link = __sveltets_1_invalidate(() => `${tutorial_repo_link}/${selected.chapter.section_dir}/${selected.chapter.chapter_dir}`);       {/**
   ╚let••improve_link•=•__sveltets_1_invalidate(()•=>•`${tutorial_repo_link}/${selected.chapter.section_dir}/${selected.chapter.chapter_dir}`);↲    [generated] line 77
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
    let  mobile = __sveltets_1_invalidate(() => width < 768);                                                                                         {/**
   ╚let••mobile•=•__sveltets_1_invalidate(()•=>•width•<•768);↲    [generated] line 92                                                                 
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
() => (<>                                                                                                                                             {/**
========#     Originless mappings                                                                                                                     
()•=>•(<>↲    [generated] line 119                                                                                                                    
         ↲                                                                                                                                            
</script>↲    [original] line 14 (rest generated at line 15)                                                                                          
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
<sveltehead>                                                                                                                                          {/**
<sveltehead>↲     [generated] line 125                                                                                                                
<svelte head>↲                                                                                                                                        
<svelte:head>↲    [original] line 261                                                                                                                 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    <title>{selected.section.title} / {selected.chapter.title} • Svelte Tutorial</title>
                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    <meta name="twitter:title" content="Svelte tutorial"/>                                                                                            {/**
   ╚<meta•name="twitter:title"•content="Svelte•tutorial"/>↲    [generated] line 128                                                                   
   ╚<meta•n   ="twitter:title"•c      ="Svelte•tutorial" >↲                                                                                           
   ╚<meta•n   ="twitter:title"•c      ="Svelte•tutorial">↲                                                                                            
   ╚<meta•name="twitter:title"•content="Svelte•tutorial">↲     [original] line 264                                                                    
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    <meta name="twitter:description" content={`${selected.section.title} / ${selected.chapter.title}`}/>                                              {/**
   ╚<meta•name="twitter:description"•content={`${selected.section.title}•/•${selected.chapter.title}`}/>↲    [generated] line 129                     
   ╚<meta•n   ="twitter:description"•c      =   {selected.section.title}•/• {selected.chapter.title}"  >↲                                             
   ╚<meta•n   ="twitter:description"•c      = {selected.section.title}•/•{selected.chapter.title}">↲                                                  
   ╚<meta•name="twitter:description"•content="{selected.section.title}•/•{selected.chapter.title}">↲         [original] line 265                      
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    <meta name="Description" content={`${selected.section.title} / ${selected.chapter.title}`}/>                                                      {/**
   ╚<meta•name="Description"•content={`${selected.section.title}•/•${selected.chapter.title}`}/>↲    [generated] line 130                             
   ╚<meta•n   ="Description"•c      =   {selected.section.title}•/• {selected.chapter.title}"  >↲                                                     
   ╚<meta•n   ="Description"•c      = {selected.section.title}•/•{selected.chapter.title}">↲                                                          
   ╚<meta•name="Description"•content="{selected.section.title}•/•{selected.chapter.title}">↲         [original] line 266                              
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
</sveltehead>                                                                                                                                         {/**
</sveltehead>↲     [generated] line 131                                                                                                               
</svelte head>↲                                                                                                                                       
</svelte:head>↲    [original] line 267                                                                                                                
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
<sveltewindow innerWidth={width}/>                                                                                                                    {/**
<sveltewindow•innerWidth={width}/>↲          [generated] line 133                                                                                     
<svelte window•     innerWidth={width}/>↲                                                                                                             
<svelte:window•bind:innerWidth={width}/>↲    [original] line 269                                                                                      
------------------------------------------------------------------------------------------------------------------------------------------------------ */}

<div class="tutorial-outer">                                                                                                                          {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    <div class={`viewport offset-${offset}`}>                                                                                                         {/**
   ╚<div•class={`viewport•offset-${offset}`}>↲    [generated] line 136                                                                                
   ╚<div•c    =  viewport•offset- {offset}" >↲                                                                                                        
   ╚<div•c    = viewport•offset-{offset}">↲                                                                                                           
   ╚<div•class="viewport•offset-{offset}">↲       [original] line 272                                                                                 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
        <div class="tutorial-text">
            <div class="table-of-contents">                                                                                                           {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                <TableOfContents sections={sections} slug={slug} selected={selected}/>                                                                {/**
            ╚╚╚╚<TableOfContents•sections={sections}•slug={slug}•selected={selected}/>↲    [generated] line 139                                       
            ╚╚╚╚<TableOfContents•         {sections}•     {slug}•         {selected}/>↲                                                               
            ╚╚╚╚<TableOfContents•{sections}•{slug}•{selected}/>↲                           [original] line 275                                        
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
            </div>
                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
            <div class="chapter-markup" {...__sveltets_1_empty(scrollable = /*Ωignore_startΩ*/__sveltets_1_instanceOf(__sveltets_1_ctorOf(__sveltets_1_mapElementTag('div')))/*Ωignore_endΩ*/)}>{/**
         ╚╚╚<div•class="chapter-markup"•{...__sveltets_1_empty(scrollable•=•/*Ωignore_startΩ*/__sveltets_1_instanceOf(__sveltets_1_ctorOf(__sveltets_1_mapElementTag('div')))/*Ωignore_endΩ*/)}>↲    [generated] line 142
         ╚╚╚<div•c    ="chapter-markup"•b                      scrollable}                                                                                                                     >↲    
         ╚╚╚<div•c    ="chapter-markup"•b          scrollable}>↲                                                                                                                                     
         ╚╚╚<div•class="chapter-markup"•bind:this={scrollable}>↲                                                                                                                                     [original] line 278 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                { chapter.html}                                                                                                                       {/**
            ╚╚╚╚{•chapter.html}↲         [generated] line 143                                                                                         
            ╚╚╚╚{     •chapter.html}↲                                                                                                                 
            ╚╚╚╚{@html•chapter.html}↲    [original] line 279                                                                                          
------------------------------------------------------------------------------------------------------------------------------------------------------ */}

                <div class="controls">                                                                                                                {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                    {(chapter.app_b) ? <>                                                                                                             {/**
               ╚╚╚╚╚{(chapter.app_b)•?•<>↲    [generated] line 146                                                                                    
               ╚╚╚╚╚{ chapter.app_b}     ↲                                                                                                            
               ╚╚╚╚╚{    chapter.app_b}↲                                                                                                              
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
                  ╚╚╚╚╚╚╚matches•the•expected•end•result•-->↲                           [original] line 284                                           
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                        <button class="show" onclick={() => completed ? reset() : complete()}>                                                        {/**
                  ╚╚╚╚╚╚<button•class="show"•onclick={()•=>•completed•?•reset()•:•complete()}>↲       [generated] line 148                            
                  ╚╚╚╚╚╚<button•c    ="show"•on:    ={()•=>•completed•?•reset()•:•complete()}>↲                                                       
                  ╚╚╚╚╚╚<button•c    ="show"•on:     = {()•=>•completed•?•reset()•:•complete()} >↲                                                    
                  ╚╚╚╚╚╚<button•class="show"•on:click="{()•=>•completed•?•reset()•:•complete()}">↲    [original] line 285                             
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                            {completed ? 'Reset' : 'Show me'}
                        </button>                                                                                                                     {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                    </> : <></>}                                                                                                                      {/**
               ╚╚╚╚╚</>•:•<></>}↲    [generated] line 151                                                                                             
               ╚╚╚╚╚{           ↲                                                                                                                     
               ╚╚╚╚╚{    ↲                                                                                                                            
               ╚╚╚╚╚{/if}↲           [original] line 288                                                                                              
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                    {(selected.next) ? <>                                                                                                             {/**
               ╚╚╚╚╚{(selected.next)•?•<>↲    [generated] line 153                                                                                    
               ╚╚╚╚╚{ selected.next}     ↲                                                                                                            
               ╚╚╚╚╚{    selected.next}↲                                                                                                              
               ╚╚╚╚╚{#if•selected.next}↲      [original] line 290                                                                                     
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                        <a class="next" href={`tutorial/${selected.next.slug}`}>Next</a>                                                              {/**
                  ╚╚╚╚╚╚<a•class="next"•href={`tutorial/${selected.next.slug}`}>Next</a>↲    [generated] line 154                                     
                  ╚╚╚╚╚╚<a•c    ="next"•h   =  tutorial/ {selected.next.slug}" >Next</a>↲                                                             
                  ╚╚╚╚╚╚<a•c    ="next"•h   = tutorial/{selected.next.slug}">Next</a>↲                                                                
                  ╚╚╚╚╚╚<a•class="next"•href="tutorial/{selected.next.slug}">Next</a>↲       [original] line 291                                      
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                    </> : <></>}                                                                                                                      {/**
               ╚╚╚╚╚</>•:•<></>}↲    [generated] line 155                                                                                             
               ╚╚╚╚╚{           ↲                                                                                                                     
               ╚╚╚╚╚{    ↲                                                                                                                            
               ╚╚╚╚╚{/if}↲           [original] line 292                                                                                              
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                </div>

                <div class="improve-chapter">
                    <a class="no-underline" href={improve_link}>Edit this chapter</a>
                </div>
            </div>
        </div>

        <div class="tutorial-repl">
            <Repl                                                                                                                                     {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                {...__sveltets_1_empty(repl = /*Ωignore_startΩ*/new Repl({target: __sveltets_1_any(''), props: __sveltets_1_any('')})/*Ωignore_endΩ*/)}{/**
            ╚╚╚╚{...__sveltets_1_empty(repl•=•/*Ωignore_startΩ*/new•Repl({target:•__sveltets_1_any(''),•props:•__sveltets_1_any('')})/*Ωignore_endΩ*/)}↲    [generated] line 166
            ╚╚╚╚b                      repl}                                                                                                           ↲    
            ╚╚╚╚b          repl}↲                                                                                                                           
            ╚╚╚╚bind:this={repl}↲                                                                                                                           [original] line 303 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                workersUrl="workers"                                                                                                                  {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                svelteUrl={svelteUrl}                                                                                                                 {/**
            ╚╚╚╚svelteUrl={svelteUrl}↲    [generated] line 168                                                                                        
            ╚╚╚╚          {svelteUrl}↲                                                                                                                
            ╚╚╚╚{svelteUrl}↲              [original] line 305                                                                                         
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                rollupUrl={rollupUrl}                                                                                                                 {/**
            ╚╚╚╚rollupUrl={rollupUrl}↲    [generated] line 169                                                                                        
            ╚╚╚╚          {rollupUrl}↲                                                                                                                
            ╚╚╚╚{rollupUrl}↲              [original] line 306                                                                                         
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                orientation={mobile ? 'columns' : 'rows'}
                fixed={mobile}                                                                                                                        {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
            ╚╚╚╚↲                             [generated] line 172                                                                                    
            ╚╚╚╚                         ↲                                                                                                            
            ╚╚╚╚on:change={handle_change}↲    [original] line 309 (rest generated at line 175)                                                        
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                injectedJS={mapbox_setup}
                relaxed                                                                                                                               {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
            />{/*Ωignore_startΩ*/new Repl({target: __sveltets_1_any(''), props: {'workersUrl':"workers", 'svelteUrl':svelteUrl, 'rollupUrl':rollupUrl, 'orientation':mobile ? 'columns' : 'rows', 'fixed':mobile, 'injectedJS':mapbox_setup, 'relaxed':true}})/*Ωignore_endΩ*/.$on('change', handle_change)}{/**
         ╚╚╚/>{/*Ωignore_startΩ*/new•Repl({target:•__sveltets_1_any(''),•props:•{'workersUrl':"workers",•'svelteUrl':svelteUrl,•'rollupUrl':rollupUrl,•'orientation':mobile•?•'columns'•:•'rows',•'fixed':mobile,•'injectedJS':mapbox_setup,•'relaxed':true}})/*Ωignore_endΩ*/.$on('change',•handle_change)}↲    [generated] line 175
                                                                                                                                                                                                                                                                                on('change',•handle_change)}     [generated] subset
                                                                                                                                                                                                                                                                                on: change=  handle_change}      
             on:change= handle_change}                                                                                                                                                                                                                                                                           
         ╚╚╚╚on:change={handle_change}↲                                                                                                                                                                                                                                                                          [original] line 309 (rest generated at line 172)
                                                                                                                                                                                                                                                                                                                 
         ╚╚╚/>{/*Ωignore_startΩ*/new•Repl({target:•__sveltets_1_any(''),•props:•{'workersUrl':"workers",•'svelteUrl':svelteUrl,•'rollupUrl':rollupUrl,•'orientation':mobile•?•'columns'•:•'rows',•'fixed':mobile,•'injectedJS':mapbox_setup,•'relaxed':true}})/*Ωignore_endΩ*/.$on('change',•handle_change)}↲    [generated] line 175
         ╚╚╚/>{/*Ωignore_startΩ*/new•Repl({target:•__sveltets_1_any(''),•props:•{'workersUrl':"workers",•'svelteUrl':svelteUrl,•'rollupUrl':rollupUrl,•'orientation':mobile•?•'columns'•:•'rows',•'fixed':mobile,•'injectedJS':mapbox_setup,•'relaxed':true}})/*Ωignore_endΩ*/.$                            ↲    [generated] subset
         ╚╚╚/>                                                                                                                                                                                                                                                                                              ↲    
         ╚╚╚/>↲                                                                                                                                                                                                                                                                                                  [original] line 312 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
        </div>
    </div>
                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    {(mobile) ? <>                                                                                                                                    {/**
   ╚{(mobile)•?•<>↲    [generated] line 179                                                                                                           
   ╚{ mobile}     ↲                                                                                                                                   
   ╚{    mobile}↲                                                                                                                                     
   ╚{#if•mobile}↲      [original] line 316                                                                                                            
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
        <ScreenToggle offset={offset} labels={['tutorial', 'input', 'output']}/>                                                                      {/**
      ╚╚<ScreenToggle•offset={offset}•labels={['tutorial',•'input',•'output']}/>↲    [generated] line 180                                             
      ╚╚<ScreenToggle•        offset •labels={['tutorial',•'input',•'output']}/>↲                                                                     
      ╚╚<ScreenToggle•     offset•labels={['tutorial',•'input',•'output']}/>↲                                                                         
      ╚╚<ScreenToggle•bind:offset•labels={['tutorial',•'input',•'output']}/>↲        [original] line 317                                              
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    </> : <></>}                                                                                                                                      {/**
   ╚</>•:•<></>}↲    [generated] line 181                                                                                                             
   ╚{           ↲                                                                                                                                     
   ╚{    ↲                                                                                                                                            
   ╚{/if}↲           [original] line 318                                                                                                              
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
</div></>);                                                                                                                                           {/**
</div></>);↲    [generated] line 182                                                                                                                  
</div>          [original] line 319                                                                                                                   
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
return { props: {slug: slug , chapter: chapter}, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}