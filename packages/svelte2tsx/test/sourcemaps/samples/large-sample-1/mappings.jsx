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
</script>↲    [original] line 14 (rest generated at line 117)                                                                                         
                                                                                                                                                      
;<></>;↲      [generated] line 15                                                                                                                     
   </>;↲      [generated] subset                                                                                                                      
   <                                                                                                                                                  
<                                                                                                                                                     
<script>↲     [original] line 16 (rest generated at lines 25, 26)                                                                                     
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
import Repl from '@sveltejs/svelte-repl';                                                                                                             {/**
import•Repl•from•'@sveltejs/svelte-repl';↲     [generated] line 16                                                                                    
import•Repl•from•'@sveltejs/svelte-repl';                                                                                                             
 import•Repl•from•'@sveltejs/svelte-repl';                                                                                                            
╚import•Repl•from•'@sveltejs/svelte-repl';↲    [original] line 17 (rest generated at line 27)                                                         
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
import { getContext } from 'svelte';                                                                                                                  {/**
import•{•getContext•}•from•'svelte';↲     [generated] line 17                                                                                         
import•{•getContext•}•from•'svelte';                                                                                                                  
 import•{•getContext•}•from•'svelte';                                                                                                                 
╚import•{•getContext•}•from•'svelte';↲    [original] line 18 (rest generated at line 28)                                                              
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
import ScreenToggle from '../../../components/ScreenToggle.svelte';                                                                                   {/**
import•ScreenToggle•from•'../../../components/ScreenToggle.svelte';↲     [generated] line 18                                                          
import•ScreenToggle•from•'../../../components/ScreenToggle.svelte';                                                                                   
 import•ScreenToggle•from•'../../../components/ScreenToggle.svelte';                                                                                  
╚import•ScreenToggle•from•'../../../components/ScreenToggle.svelte';↲    [original] line 20 (rest generated at line 30)                               
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
import TableOfContents from './_TableOfContents.svelte';                                                                                              {/**
import•TableOfContents•from•'./_TableOfContents.svelte';↲     [generated] line 19                                                                     
import•TableOfContents•from•'./_TableOfContents.svelte';                                                                                              
 import•TableOfContents•from•'./_TableOfContents.svelte';                                                                                             
╚import•TableOfContents•from•'./_TableOfContents.svelte';↲    [original] line 21 (rest generated at line 31)                                          
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
import {                                                                                                                                              {/**
import•{↲     [generated] line 20                                                                                                                     
 import•{↲                                                                                                                                            
╚import•{↲    [original] line 23 (rest generated at line 33)                                                                                          
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
        mapbox_setup, // needed for context API tutorial
        rollupUrl,
        svelteUrl                                                                                                                                     {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    } from '../../../config';                                                                                                                         {/**
   ╚}•from•'../../../config';↲    [generated] line 24                                                                                                 
   ╚}•from•'../../../config';                                                                                                                         
   ╚}•from•'../../../config';↲    [original] line 27 (rest generated at line 33)                                                                      
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
function render() {                                                                                                                                   {/**
function•render()•{↲    [generated] line 25                                                                                                           
s                                                                                                                                                     
 s                                                                                                                                                    
<script>↲               [original] line 16 (rest generated at lines 15, 26)                                                                           
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲            [generated] line 26                                                                                                                      
        ↲                                                                                                                                             
<script>↲    [original] line 16 (rest generated at lines 15, 25)                                                                                      
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
   ╚↲                                             [generated] line 27                                                                                 
   ╚                                         ↲                                                                                                        
   ╚import•Repl•from•'@sveltejs/svelte-repl';↲    [original] line 17 (rest generated at line 16)                                                      
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
   ╚↲                                        [generated] line 28                                                                                      
   ╚                                    ↲                                                                                                             
   ╚import•{•getContext•}•from•'svelte';↲    [original] line 18 (rest generated at line 17)                                                           
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
   ╚↲                                                                       [generated] line 30                                                       
   ╚                                                                   ↲                                                                              
   ╚import•ScreenToggle•from•'../../../components/ScreenToggle.svelte';↲    [original] line 20 (rest generated at line 18)                            
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
   ╚↲                                                            [generated] line 31                                                                  
   ╚                                                        ↲                                                                                         
   ╚import•TableOfContents•from•'./_TableOfContents.svelte';↲    [original] line 21 (rest generated at line 19)                                       
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
   ╚↲                             [generated] line 33                                                                                                 
   ╚                              [generated] subset                                                                                                  
   ╚                                                                                                                                                  
   ╚import•{↲                     [original] line 23 (rest generated at line 20)                                                                      
                                                                                                                                                      
   ╚↲                             [generated] line 33                                                                                                 
    ↲                             [generated] subset                                                                                                  
                             ↲                                                                                                                        
   ╚}•from•'../../../config';↲    [original] line 27 (rest generated at line 24)                                                                      
------------------------------------------------------------------------------------------------------------------------------------------------------ */}

                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     let slug;                                                                                                                                        {/**
   ╚•let•slug;↲          [generated] line 36                                                                                                          
   ╚      •let•slug;↲                                                                                                                                 
   ╚export•let•slug;↲    [original] line 30                                                                                                           
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
     let chapter;                                                                                                                                     {/**
   ╚•let•chapter;↲          [generated] line 37                                                                                                       
   ╚      •let•chapter;↲                                                                                                                              
   ╚export•let•chapter;↲    [original] line 31                                                                                                        
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
   ╚;()•=>•{$:•if•(scrollable)•chapter,•scrollable.scrollTo(0,•0);}↲    [generated] line 68                                                           
   ╚        $:•if•(scrollable)•chapter,•scrollable.scrollTo(0,•0); ↲                                                                                  
   ╚$:•if•(scrollable)•chapter,•scrollable.scrollTo(0,•0);↲             [original] line 62                                                            
------------------------------------------------------------------------------------------------------------------------------------------------------ */}

    // TODO: this will need to be changed to the master branch, and probably should be dynamic instead of included
    //   here statically
    const tutorial_repo_link = 'https://github.com/sveltejs/svelte/tree/master/site/content/tutorial';
                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    let  selected = __sveltets_invalidate(() => lookup.get(slug));                                                                                    {/**
   ╚let••selected•=•__sveltets_invalidate(()•=>•lookup.get(slug));↲    [generated] line 74                                                            
   ╚    •selected•=•                            lookup.get(slug) ;↲                                                                                   
   ╚  •selected•=•lookup.get(slug);↲                                                                                                                  
   ╚$:•selected•=•lookup.get(slug);↲                                   [original] line 68                                                             
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    let  improve_link = __sveltets_invalidate(() => `${tutorial_repo_link}/${selected.chapter.section_dir}/${selected.chapter.chapter_dir}`);         {/**
   ╚let••improve_link•=•__sveltets_invalidate(()•=>•`${tutorial_repo_link}/${selected.chapter.section_dir}/${selected.chapter.chapter_dir}`);↲    [generated] line 75
   ╚    •improve_link•=•                            `${tutorial_repo_link}/${selected.chapter.section_dir}/${selected.chapter.chapter_dir}` ;↲        
   ╚  •improve_link•=•`${tutorial_repo_link}/${selected.chapter.section_dir}/${selected.chapter.chapter_dir}`;↲                                       
   ╚$:•improve_link•=•`${tutorial_repo_link}/${selected.chapter.section_dir}/${selected.chapter.chapter_dir}`;↲                                   [original] line 69 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}

    const clone = file => ({
        name: file.name,
        type: file.type,
        source: file.source
    });
                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    ;() => {$: if (repl) {                                                                                                                            {/**
   ╚;()•=>•{$:•if•(repl)•{↲    [generated] line 83                                                                                                    
   ╚        $:•if•(repl)•{↲                                                                                                                           
   ╚$:•if•(repl)•{↲            [original] line 77                                                                                                     
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
        completed = false;
        repl.set({
            components: chapter.app_a.map(clone)
        });                                                                                                                                           {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    }}                                                                                                                                                {/**
   ╚}}↲    [generated] line 88                                                                                                                        
   ╚} ↲                                                                                                                                               
   ╚}↲     [original] line 82                                                                                                                         
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    let  mobile = __sveltets_invalidate(() => width < 768);                                                                                           {/**
   ╚let••mobile•=•__sveltets_invalidate(()•=>•width•<•768);↲    [generated] line 90                                                                   
   ╚    •mobile•=•                            width•<•768 ;↲                                                                                          
   ╚  •mobile•=•width•<•768;↲                                                                                                                         
   ╚$:•mobile•=•width•<•768;↲                                   [original] line 84                                                                    
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
;↲            [generated] line 116                                                                                                                    
<                                                                                                                                                     
</script>↲    [original] line 110 (rest generated at line 119)                                                                                        
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
() => (<>                                                                                                                                             {/**
========#     Originless mappings                                                                                                                     
()•=>•(<>↲    [generated] line 117                                                                                                                    
         ↲                                                                                                                                            
</script>↲    [original] line 14 (rest generated at line 15)                                                                                          
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲             [generated] line 119                                                                                                                    
         ↲                                                                                                                                            
</script>↲    [original] line 110 (rest generated at line 116)                                                                                        
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
↲            [generated] line 121                                                                                                                     
        ↲                                                                                                                                             
</style>↲    [original] line 260                                                                                                                      
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
<sveltehead>                                                                                                                                          {/**
<sveltehead>↲     [generated] line 123                                                                                                                
<svelte head>↲                                                                                                                                        
<svelte:head>↲    [original] line 262                                                                                                                 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    <title>{selected.section.title} / {selected.chapter.title} • Svelte Tutorial</title>
                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    <meta name="twitter:title" content="Svelte tutorial"/>                                                                                            {/**
   ╚<meta•name="twitter:title"•content="Svelte•tutorial"/>↲    [generated] line 126                                                                   
   ╚<meta•n   ="twitter:title"•c      ="Svelte•tutorial" >↲                                                                                           
   ╚<meta•n   ="twitter:title"•c      ="Svelte•tutorial">↲                                                                                            
   ╚<meta•name="twitter:title"•content="Svelte•tutorial">↲     [original] line 265                                                                    
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    <meta name="twitter:description" content={`${selected.section.title} / ${selected.chapter.title}`}/>                                              {/**
   ╚<meta•name="twitter:description"•content={`${selected.section.title}•/•${selected.chapter.title}`}/>↲    [generated] line 127                     
   ╚<meta•n   ="twitter:description"•c      =   {selected.section.title}•/• {selected.chapter.title}"  >↲                                             
   ╚<meta•n   ="twitter:description"•c      = {selected.section.title}•/•{selected.chapter.title}">↲                                                  
   ╚<meta•name="twitter:description"•content="{selected.section.title}•/•{selected.chapter.title}">↲         [original] line 266                      
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    <meta name="Description" content={`${selected.section.title} / ${selected.chapter.title}`}/>                                                      {/**
   ╚<meta•name="Description"•content={`${selected.section.title}•/•${selected.chapter.title}`}/>↲    [generated] line 128                             
   ╚<meta•n   ="Description"•c      =   {selected.section.title}•/• {selected.chapter.title}"  >↲                                                     
   ╚<meta•n   ="Description"•c      = {selected.section.title}•/•{selected.chapter.title}">↲                                                          
   ╚<meta•name="Description"•content="{selected.section.title}•/•{selected.chapter.title}">↲         [original] line 267                              
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
</sveltehead>                                                                                                                                         {/**
</sveltehead>↲     [generated] line 129                                                                                                               
</svelte head>↲                                                                                                                                       
</svelte:head>↲    [original] line 268                                                                                                                
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
<sveltewindow innerWidth={width}/>                                                                                                                    {/**
<sveltewindow•innerWidth={width}/>↲          [generated] line 131                                                                                     
<svelte window•     innerWidth={width}/>↲                                                                                                             
<svelte:window•bind:innerWidth={width}/>↲    [original] line 270                                                                                      
------------------------------------------------------------------------------------------------------------------------------------------------------ */}

<div class="tutorial-outer">                                                                                                                          {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    <div class={`viewport offset-${offset}`}>                                                                                                         {/**
   ╚<div•class={`viewport•offset-${offset}`}>↲    [generated] line 134                                                                                
   ╚<div•c    =  viewport•offset- {offset}" >↲                                                                                                        
   ╚<div•c    = viewport•offset-{offset}">↲                                                                                                           
   ╚<div•class="viewport•offset-{offset}">↲       [original] line 273                                                                                 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
        <div class="tutorial-text">
            <div class="table-of-contents">                                                                                                           {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                <TableOfContents sections={sections} slug={slug} selected={selected}/>                                                                {/**
            ╚╚╚╚<TableOfContents•sections={sections}•slug={slug}•selected={selected}/>↲    [generated] line 137                                       
            ╚╚╚╚<TableOfContents•         {sections}•     {slug}•         {selected}/>↲                                                               
            ╚╚╚╚<TableOfContents•{sections}•{slug}•{selected}/>↲                           [original] line 276                                        
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
            </div>
                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
            <div class="chapter-markup" {...__sveltets_ensureType(__sveltets_ctorOf(__sveltets_mapElementTag('div')), scrollable)}>                   {/**
         ╚╚╚<div•class="chapter-markup"•{...__sveltets_ensureType(__sveltets_ctorOf(__sveltets_mapElementTag('div')),•scrollable)}>↲    [generated] line 140
         ╚╚╚<div•c    ="chapter-markup"•                                                                              scrollable} >↲                  
         ╚╚╚<div•c    ="chapter-markup"•           scrollable}>↲                                                                                      
         ╚╚╚<div•class="chapter-markup"•bind:this={scrollable}>↲                                                                        [original] line 279 
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                { chapter.html}                                                                                                                       {/**
            ╚╚╚╚{•chapter.html}↲         [generated] line 141                                                                                         
            ╚╚╚╚{     •chapter.html}↲                                                                                                                 
            ╚╚╚╚{@html•chapter.html}↲    [original] line 280                                                                                          
------------------------------------------------------------------------------------------------------------------------------------------------------ */}

                <div class="controls">                                                                                                                {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                    {(chapter.app_b) ? <>                                                                                                             {/**
               ╚╚╚╚╚{(chapter.app_b)•?•<>↲    [generated] line 144                                                                                    
               ╚╚╚╚╚{ chapter.app_b}     ↲                                                                                                            
               ╚╚╚╚╚{    chapter.app_b}↲                                                                                                              
               ╚╚╚╚╚{#if•chapter.app_b}↲      [original] line 283                                                                                     
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
                  ╚╚╚╚╚╚↲                                                               [generated] line 145                                          
                  ╚╚╚╚╚╚                                                                [generated] subset                                            
                  ╚╚╚╚╚╚                                                                                                                              
                  ╚╚╚╚╚╚<!--•TODO•disable•this•button•when•the•contents•of•the•REPL↲    [original] line 284                                           
                                                                                                                                                      
                  ╚╚╚╚╚╚↲                                                               [generated] line 145                                          
                        ↲                                                               [generated] subset                                            
                                                            ↲                                                                                         
                  ╚╚╚╚╚╚╚matches•the•expected•end•result•-->↲                           [original] line 285                                           
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                        <button class="show" onclick={() => completed ? reset() : complete()}>                                                        {/**
                  ╚╚╚╚╚╚<button•class="show"•onclick={()•=>•completed•?•reset()•:•complete()}>↲       [generated] line 146                            
                  ╚╚╚╚╚╚<button•c    ="show"•on:    ={()•=>•completed•?•reset()•:•complete()}>↲                                                       
                  ╚╚╚╚╚╚<button•c    ="show"•on:     = {()•=>•completed•?•reset()•:•complete()} >↲                                                    
                  ╚╚╚╚╚╚<button•class="show"•on:click="{()•=>•completed•?•reset()•:•complete()}">↲    [original] line 286                             
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                            {completed ? 'Reset' : 'Show me'}
                        </button>                                                                                                                     {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                    </> : <></>}                                                                                                                      {/**
               ╚╚╚╚╚</>•:•<></>}↲    [generated] line 149                                                                                             
               ╚╚╚╚╚{           ↲                                                                                                                     
               ╚╚╚╚╚{    ↲                                                                                                                            
               ╚╚╚╚╚{/if}↲           [original] line 289                                                                                              
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                    {(selected.next) ? <>                                                                                                             {/**
               ╚╚╚╚╚{(selected.next)•?•<>↲    [generated] line 151                                                                                    
               ╚╚╚╚╚{ selected.next}     ↲                                                                                                            
               ╚╚╚╚╚{    selected.next}↲                                                                                                              
               ╚╚╚╚╚{#if•selected.next}↲      [original] line 291                                                                                     
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                        <a class="next" href={`tutorial/${selected.next.slug}`}>Next</a>                                                              {/**
                  ╚╚╚╚╚╚<a•class="next"•href={`tutorial/${selected.next.slug}`}>Next</a>↲    [generated] line 152                                     
                  ╚╚╚╚╚╚<a•c    ="next"•h   =  tutorial/ {selected.next.slug}" >Next</a>↲                                                             
                  ╚╚╚╚╚╚<a•c    ="next"•h   = tutorial/{selected.next.slug}">Next</a>↲                                                                
                  ╚╚╚╚╚╚<a•class="next"•href="tutorial/{selected.next.slug}">Next</a>↲       [original] line 292                                      
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                    </> : <></>}                                                                                                                      {/**
               ╚╚╚╚╚</>•:•<></>}↲    [generated] line 153                                                                                             
               ╚╚╚╚╚{           ↲                                                                                                                     
               ╚╚╚╚╚{    ↲                                                                                                                            
               ╚╚╚╚╚{/if}↲           [original] line 293                                                                                              
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
                {...__sveltets_ensureType(Repl, repl)}                                                                                                {/**
            ╚╚╚╚{...__sveltets_ensureType(Repl,•repl)}↲    [generated] line 164                                                                       
            ╚╚╚╚                                repl} ↲                                                                                               
            ╚╚╚╚           repl}↲                                                                                                                     
            ╚╚╚╚bind:this={repl}↲                          [original] line 304                                                                        
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                workersUrl="workers"                                                                                                                  {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                svelteUrl={svelteUrl}                                                                                                                 {/**
            ╚╚╚╚svelteUrl={svelteUrl}↲    [generated] line 166                                                                                        
            ╚╚╚╚          {svelteUrl}↲                                                                                                                
            ╚╚╚╚{svelteUrl}↲              [original] line 306                                                                                         
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                rollupUrl={rollupUrl}                                                                                                                 {/**
            ╚╚╚╚rollupUrl={rollupUrl}↲    [generated] line 167                                                                                        
            ╚╚╚╚          {rollupUrl}↲                                                                                                                
            ╚╚╚╚{rollupUrl}↲              [original] line 307                                                                                         
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                orientation={mobile ? 'columns' : 'rows'}
                fixed={mobile}                                                                                                                        {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                                                                                                                                                      {/**
            ╚╚╚╚↲                             [generated] line 170                                                                                    
            ╚╚╚╚                         ↲                                                                                                            
            ╚╚╚╚on:change={handle_change}↲    [original] line 310 (rest generated at line 173)                                                        
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
                injectedJS={mapbox_setup}
                relaxed                                                                                                                               {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
            />{__sveltets_instanceOf(Repl).$on('change', handle_change)}                                                                              {/**
         ╚╚╚/>{__sveltets_instanceOf(Repl).$on('change',•handle_change)}↲    [generated] line 173                                                     
                                            on('change',•handle_change)}     [generated] subset                                                       
                                            on: change=  handle_change}                                                                               
             on:change= handle_change}                                                                                                                
         ╚╚╚╚on:change={handle_change}↲                                      [original] line 310 (rest generated at line 170)                         
                                                                                                                                                      
         ╚╚╚/>{__sveltets_instanceOf(Repl).$on('change',•handle_change)}↲    [generated] line 173                                                     
         ╚╚╚/>{__sveltets_instanceOf(Repl).$                            ↲    [generated] subset                                                       
         ╚╚╚/>                                                          ↲                                                                             
         ╚╚╚/>↲                                                              [original] line 313                                                      
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
        </div>
    </div>
                                                                                                                                                      {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    {(mobile) ? <>                                                                                                                                    {/**
   ╚{(mobile)•?•<>↲    [generated] line 177                                                                                                           
   ╚{ mobile}     ↲                                                                                                                                   
   ╚{    mobile}↲                                                                                                                                     
   ╚{#if•mobile}↲      [original] line 317                                                                                                            
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
        <ScreenToggle offset={offset} labels={['tutorial', 'input', 'output']}/>                                                                      {/**
      ╚╚<ScreenToggle•offset={offset}•labels={['tutorial',•'input',•'output']}/>↲    [generated] line 178                                             
      ╚╚<ScreenToggle•        offset •labels={['tutorial',•'input',•'output']}/>↲                                                                     
      ╚╚<ScreenToggle•     offset•labels={['tutorial',•'input',•'output']}/>↲                                                                         
      ╚╚<ScreenToggle•bind:offset•labels={['tutorial',•'input',•'output']}/>↲        [original] line 318                                              
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
    </> : <></>}                                                                                                                                      {/**
   ╚</>•:•<></>}↲    [generated] line 179                                                                                                             
   ╚{           ↲                                                                                                                                     
   ╚{    ↲                                                                                                                                            
   ╚{/if}↲           [original] line 319                                                                                                              
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
</div></>);                                                                                                                                           {/**
</div></>);↲    [generated] line 180                                                                                                                  
</div>          [original] line 320                                                                                                                   
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
return { props: {slug: slug , chapter: chapter}, slots: {}, getters: {}, setters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}