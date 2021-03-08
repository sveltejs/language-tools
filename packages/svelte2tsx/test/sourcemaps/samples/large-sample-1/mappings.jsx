///<reference types="svelte" />
<></>;                                                                                                                                      {/** 
-----------------------------------------------------------------# Line 2 #-----------------------------------------------------------------
		☼☼                         	Originless characters
		<></>;↲                    	[generated] line 2
		  <   ↲                    	
		<                        ↲ 	
		<script•context="module">↲ 	[original] line 1
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
	export async function preload({ params }) {
		const res = await this.fetch(`tutorial/${params.slug}.json`);

		if (!res.ok) {
			return this.redirect(301, `tutorial/basics`);
		}

		return {
			slug: params.slug,
			chapter: await res.json()
		};
	}
;<></>;                                                                                                                                     {/** 
----------------------------------------------------------------# Line 15 #-----------------------------------------------------------------
		;<></>;↲   	[generated] line 15
		;<>        	[generated] subset
		<          	
		</script>↲ 	[original] line 14 (rest generated at line 115)
		           	
		;<></>;↲   	[generated] line 15
		   </>;↲   	[generated] subset
		   <       	
		<          	
		<script>↲  	[original] line 16 (rest generated at lines 25, 26)
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
import Repl from '@sveltejs/svelte-repl';                                                                                                   {/** 
----------------------------------------------------------------# Line 16 #-----------------------------------------------------------------
		import•Repl•from•'@sveltejs/svelte-repl';↲  	[generated] line 16
		import•Repl•from•'@sveltejs/svelte-repl';   	
		 import•Repl•from•'@sveltejs/svelte-repl';  	
		╚import•Repl•from•'@sveltejs/svelte-repl';↲ 	[original] line 17 (rest generated at line 27)
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
import { getContext } from 'svelte';                                                                                                        {/** 
----------------------------------------------------------------# Line 17 #-----------------------------------------------------------------
		import•{•getContext•}•from•'svelte';↲ 	[generated] line 17
		import•{•getContext•}•from•'svelte';  	
		import•{•getContext•}•from•'svelte';↲ 	[original] line 18 (rest generated at line 28)
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
import ScreenToggle from '../../../components/ScreenToggle.svelte';                                                                         {/** 
----------------------------------------------------------------# Line 18 #-----------------------------------------------------------------
		import•ScreenToggle•from•'../../../components/ScreenToggle.svelte';↲ 	[generated] line 18
		import•ScreenToggle•from•'../../../components/ScreenToggle.svelte';  	
		import•ScreenToggle•from•'../../../components/ScreenToggle.svelte';↲ 	[original] line 19 (rest generated at line 29)
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
import {
mapbox_setup,
rollupUrl,
svelteUrl
} from '../../../config';                                                                                                                   {/** 
----------------------------------------------------------------# Line 23 #-----------------------------------------------------------------
		}•from•'../../../config';↲ 	[generated] line 23
		}•from•'../../../config';  	
		}•from•'../../../config';↲ 	[original] line 24 (rest generated at line 30)
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
import TableOfContents from './_TableOfContents.svelte';                                                                                    {/** 
----------------------------------------------------------------# Line 24 #-----------------------------------------------------------------
		import•TableOfContents•from•'./_TableOfContents.svelte';↲ 	[generated] line 24
		import•TableOfContents•from•'./_TableOfContents.svelte';  	
		import•TableOfContents•from•'./_TableOfContents.svelte';↲ 	[original] line 25 (rest generated at line 31)
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
function render() {                                                                                                                         {/** 
----------------------------------------------------------------# Line 25 #-----------------------------------------------------------------
		function•render()•{↲ 	[generated] line 25
		s                    	
		 s                   	
		<script>↲            	[original] line 16 (rest generated at lines 15, 26)
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
                                                                                                                                            {/** 
----------------------------------------------------------------# Line 26 #-----------------------------------------------------------------
		↲         	[generated] line 26
		        ↲ 	
		<script>↲ 	[original] line 16 (rest generated at lines 15, 25)
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
                                                                                                                                            {/** 
----------------------------------------------------------------# Line 27 #-----------------------------------------------------------------
		╚↲                                          	[generated] line 27
		╚                                         ↲ 	
		╚import•Repl•from•'@sveltejs/svelte-repl';↲ 	[original] line 17 (rest generated at line 16)
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
                                                                                                                                            {/** 
----------------------------------------------------------------# Line 28 #-----------------------------------------------------------------
		↲                                     	[generated] line 28
		                                    ↲ 	
		import•{•getContext•}•from•'svelte';↲ 	[original] line 18 (rest generated at line 17)
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
                                                                                                                                            {/** 
----------------------------------------------------------------# Line 29 #-----------------------------------------------------------------
		↲                                                                    	[generated] line 29
		                                                                   ↲ 	
		import•ScreenToggle•from•'../../../components/ScreenToggle.svelte';↲ 	[original] line 19 (rest generated at line 18)
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
                                                                                                                                            {/** 
----------------------------------------------------------------# Line 30 #-----------------------------------------------------------------
		↲                          	[generated] line 30
		                         ↲ 	
		}•from•'../../../config';↲ 	[original] line 24 (rest generated at line 23)
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
                                                                                                                                            {/** 
----------------------------------------------------------------# Line 31 #-----------------------------------------------------------------
		↲                                                         	[generated] line 31
		                                                        ↲ 	
		import•TableOfContents•from•'./_TableOfContents.svelte';↲ 	[original] line 25 (rest generated at line 24)
-------------------------------------------------------------------------------------------------------------------------------------------- */} 


     let slug;                                                                                                                              {/** 
----------------------------------------------------------------# Line 34 #-----------------------------------------------------------------
		╚•let•slug;↲       	[generated] line 34
		╚      •let•slug;↲ 	
		╚export•let•slug;↲ 	[original] line 28
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
     let chapter;                                                                                                                           {/** 
----------------------------------------------------------------# Line 35 #-----------------------------------------------------------------
		╚•let•chapter;↲       	[generated] line 35
		╚      •let•chapter;↲ 	
		╚export•let•chapter;↲ 	[original] line 29
-------------------------------------------------------------------------------------------------------------------------------------------- */} 

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
    ;() => {$: if (scrollable) chapter, scrollable.scrollTo(0, 0);}                                                                         {/** 
----------------------------------------------------------------# Line 66 #-----------------------------------------------------------------
		╚;()•=>•{$:•if•(scrollable)•chapter,•scrollable.scrollTo(0,•0);}↲ 	[generated] line 66
		╚        $:•if•(scrollable)•chapter,•scrollable.scrollTo(0,•0); ↲ 	
		╚$:•if•(scrollable)•chapter,•scrollable.scrollTo(0,•0);↲          	[original] line 60
-------------------------------------------------------------------------------------------------------------------------------------------- */} 

	// TODO: this will need to be changed to the master branch, and probably should be dynamic instead of included
	//   here statically
	const tutorial_repo_link = 'https://github.com/sveltejs/svelte/tree/master/site/content/tutorial';

    let  selected = __sveltets_invalidate(() => lookup.get(slug));                                                                          {/** 
----------------------------------------------------------------# Line 72 #-----------------------------------------------------------------
		╚let••selected•=•__sveltets_invalidate(()•=>•lookup.get(slug));↲ 	[generated] line 72
		╚    •selected•=•                            lookup.get(slug) ;↲ 	
		╚  •selected•=•lookup.get(slug);↲                                	
		╚$:•selected•=•lookup.get(slug);↲                                	[original] line 66
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
    let  improve_link = __sveltets_invalidate(() => `${tutorial_repo_link}/${selected.chapter.section_dir}/${selected.chapter.chapter_dir}`); {/** 
----------------------------------------------------------------# Line 73 #-----------------------------------------------------------------
		╚let••improve_link•=•__sveltets_invalidate(()•=>•`${tutorial_repo_link}/${selected.chapter.section_dir}/${selected.chapter.chapter_dir}`);↲ 	[generated] line 73
		╚    •improve_link•=•                            `${tutorial_repo_link}/${selected.chapter.section_dir}/${selected.chapter.chapter_dir}` ;↲ 	
		╚  •improve_link•=•`${tutorial_repo_link}/${selected.chapter.section_dir}/${selected.chapter.chapter_dir}`;↲                                	
		╚$:•improve_link•=•`${tutorial_repo_link}/${selected.chapter.section_dir}/${selected.chapter.chapter_dir}`;↲                                	[original] line 67
-------------------------------------------------------------------------------------------------------------------------------------------- */} 

	const clone = file => ({
		name: file.name,
		type: file.type,
		source: file.source
	});

    ;() => {$: if (repl) {                                                                                                                  {/** 
----------------------------------------------------------------# Line 81 #-----------------------------------------------------------------
		╚;()•=>•{$:•if•(repl)•{↲ 	[generated] line 81
		╚        $:•if•(repl)•{↲ 	
		╚$:•if•(repl)•{↲         	[original] line 75
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
		completed = false;
		repl.set({
			components: chapter.app_a.map(clone)
		});
    }}                                                                                                                                      {/** 
----------------------------------------------------------------# Line 86 #-----------------------------------------------------------------
		╚}}↲ 	[generated] line 86
		╚} ↲ 	
		╚}↲  	[original] line 80
-------------------------------------------------------------------------------------------------------------------------------------------- */} 

    let  mobile = __sveltets_invalidate(() => width < 768);                                                                                 {/** 
----------------------------------------------------------------# Line 88 #-----------------------------------------------------------------
		╚let••mobile•=•__sveltets_invalidate(()•=>•width•<•768);↲ 	[generated] line 88
		╚    •mobile•=•                            width•<•768 ;↲ 	
		╚  •mobile•=•width•<•768;↲                                	
		╚$:•mobile•=•width•<•768;↲                                	[original] line 82
-------------------------------------------------------------------------------------------------------------------------------------------- */} 

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
	}
;                                                                                                                                           {/** 
----------------------------------------------------------------# Line 114 #----------------------------------------------------------------
		;↲         	[generated] line 114
		<          	
		</script>↲ 	[original] line 108 (rest generated at line 117)
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
() => (<>                                                                                                                                   {/** 
----------------------------------------------------------------# Line 115 #----------------------------------------------------------------
		☼☼☼☼☼☼☼☼☼  	Originless characters
		()•=>•(<>↲ 	[generated] line 115
		         ↲ 	
		</script>↲ 	[original] line 14 (rest generated at line 15)
-------------------------------------------------------------------------------------------------------------------------------------------- */} 

                                                                                                                                            {/** 
----------------------------------------------------------------# Line 117 #----------------------------------------------------------------
		↲          	[generated] line 117
		         ↲ 	
		</script>↲ 	[original] line 108 (rest generated at line 114)
-------------------------------------------------------------------------------------------------------------------------------------------- */} 

                                                                                                                                            {/** 
----------------------------------------------------------------# Line 119 #----------------------------------------------------------------
		↲         	[generated] line 119
		        ↲ 	
		</style>↲ 	[original] line 258
-------------------------------------------------------------------------------------------------------------------------------------------- */} 

<sveltehead>                                                                                                                                {/** 
----------------------------------------------------------------# Line 121 #----------------------------------------------------------------
		<sveltehead>↲  	[generated] line 121
		<svelte head>↲ 	
		<svelte:head>↲ 	[original] line 260
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
	<title>{selected.section.title} / {selected.chapter.title} • Svelte Tutorial</title>

    <meta name="twitter:title" content="Svelte tutorial"/>                                                                                  {/** 
----------------------------------------------------------------# Line 124 #----------------------------------------------------------------
		╚<meta•name="twitter:title"•content="Svelte•tutorial"/>↲ 	[generated] line 124
		╚<meta•n   ="twitter:title"•c      ="Svelte•tutorial" >↲ 	
		╚<meta•n   ="twitter:title"•c      ="Svelte•tutorial">↲  	
		╚<meta•name="twitter:title"•content="Svelte•tutorial">↲  	[original] line 263
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
    <meta name="twitter:description" content={`${selected.section.title} / ${selected.chapter.title}`}/>                                    {/** 
----------------------------------------------------------------# Line 125 #----------------------------------------------------------------
		╚<meta•name="twitter:description"•content={`${selected.section.title}•/•${selected.chapter.title}`}/>↲ 	[generated] line 125
		╚<meta•n   ="twitter:description"•c      =   {selected.section.title}•/• {selected.chapter.title}"  >↲ 	
		╚<meta•n   ="twitter:description"•c      = {selected.section.title}•/•{selected.chapter.title}">↲      	
		╚<meta•name="twitter:description"•content="{selected.section.title}•/•{selected.chapter.title}">↲      	[original] line 264
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
    <meta name="Description" content={`${selected.section.title} / ${selected.chapter.title}`}/>                                            {/** 
----------------------------------------------------------------# Line 126 #----------------------------------------------------------------
		╚<meta•name="Description"•content={`${selected.section.title}•/•${selected.chapter.title}`}/>↲ 	[generated] line 126
		╚<meta•n   ="Description"•c      =   {selected.section.title}•/• {selected.chapter.title}"  >↲ 	
		╚<meta•n   ="Description"•c      = {selected.section.title}•/•{selected.chapter.title}">↲      	
		╚<meta•name="Description"•content="{selected.section.title}•/•{selected.chapter.title}">↲      	[original] line 265
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
</sveltehead>                                                                                                                               {/** 
----------------------------------------------------------------# Line 127 #----------------------------------------------------------------
		</sveltehead>↲  	[generated] line 127
		</svelte head>↲ 	
		</svelte:head>↲ 	[original] line 266
-------------------------------------------------------------------------------------------------------------------------------------------- */} 

<sveltewindow innerWidth={width}/>                                                                                                          {/** 
----------------------------------------------------------------# Line 129 #----------------------------------------------------------------
		<sveltewindow•innerWidth={width}/>↲       	[generated] line 129
		<svelte window•     innerWidth={width}/>↲ 	
		<svelte:window•bind:innerWidth={width}/>↲ 	[original] line 268
-------------------------------------------------------------------------------------------------------------------------------------------- */} 

<div class="tutorial-outer">                                                                                                                {/** 
----------------------------------------------------------------# Line 131 #----------------------------------------------------------------
		<div•class="tutorial-outer">↲ 	[generated] line 131
		<div•c    ="tutorial-outer">↲ 	
		<div•class="tutorial-outer">↲ 	[original] line 270
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
    <div class={`viewport offset-${offset}`}>                                                                                               {/** 
----------------------------------------------------------------# Line 132 #----------------------------------------------------------------
		╚<div•class={`viewport•offset-${offset}`}>↲ 	[generated] line 132
		╚<div•c    =  viewport•offset- {offset}" >↲ 	
		╚<div•c    = viewport•offset-{offset}">↲    	
		╚<div•class="viewport•offset-{offset}">↲    	[original] line 271
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
        <div class="tutorial-text">                                                                                                         {/** 
----------------------------------------------------------------# Line 133 #----------------------------------------------------------------
		╚╚<div•class="tutorial-text">↲ 	[generated] line 133
		╚╚<div•c    ="tutorial-text">↲ 	
		╚╚<div•class="tutorial-text">↲ 	[original] line 272
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
            <div class="table-of-contents">                                                                                                 {/** 
----------------------------------------------------------------# Line 134 #----------------------------------------------------------------
		╚╚╚<div•class="table-of-contents">↲ 	[generated] line 134
		╚╚╚<div•c    ="table-of-contents">↲ 	
		╚╚╚<div•class="table-of-contents">↲ 	[original] line 273
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
                <TableOfContents sections={sections} slug={slug} selected={selected}/>                                                      {/** 
----------------------------------------------------------------# Line 135 #----------------------------------------------------------------
		╚╚╚╚<TableOfContents•sections={sections}•slug={slug}•selected={selected}/>↲ 	[generated] line 135
		╚╚╚╚<TableOfContents•         {sections}•     {slug}•         {selected}/>↲ 	
		╚╚╚╚<TableOfContents•{sections}•{slug}•{selected}/>↲                        	[original] line 274
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
			</div>

            <div class="chapter-markup" {...__sveltets_ensureType(__sveltets_ctorOf(__sveltets_mapElementTag('div')), scrollable)}>         {/** 
----------------------------------------------------------------# Line 138 #----------------------------------------------------------------
		╚╚╚<div•class="chapter-markup"•{...__sveltets_ensureType(__sveltets_ctorOf(__sveltets_mapElementTag('div')),•scrollable)}>↲ 	[generated] line 138
		╚╚╚<div•c    ="chapter-markup"•                                                                              scrollable} >↲ 	
		╚╚╚<div•c    ="chapter-markup"•           scrollable}>↲                                                                     	
		╚╚╚<div•class="chapter-markup"•bind:this={scrollable}>↲                                                                     	[original] line 277
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
                { chapter.html}                                                                                                             {/** 
----------------------------------------------------------------# Line 139 #----------------------------------------------------------------
		╚╚╚╚{•chapter.html}↲      	[generated] line 139
		╚╚╚╚{     •chapter.html}↲ 	
		╚╚╚╚{@html•chapter.html}↲ 	[original] line 278
-------------------------------------------------------------------------------------------------------------------------------------------- */} 

                <div class="controls">                                                                                                      {/** 
----------------------------------------------------------------# Line 141 #----------------------------------------------------------------
		╚╚╚╚<div•class="controls">↲ 	[generated] line 141
		╚╚╚╚<div•c    ="controls">↲ 	
		╚╚╚╚<div•class="controls">↲ 	[original] line 280
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
                    {(chapter.app_b) ? <>                                                                                                   {/** 
----------------------------------------------------------------# Line 142 #----------------------------------------------------------------
		╚╚╚╚╚{(chapter.app_b)•?•<>↲ 	[generated] line 142
		╚╚╚╚╚{ chapter.app_b}     ↲ 	
		╚╚╚╚╚{    chapter.app_b}↲   	
		╚╚╚╚╚{#if•chapter.app_b}↲   	[original] line 281
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
                                                                                                                                            {/** 
----------------------------------------------------------------# Line 143 #----------------------------------------------------------------
		╚╚╚╚╚╚↲                                                            	[generated] line 143
		╚╚╚╚╚╚                                                             	[generated] subset
		╚╚╚╚╚╚<!--•TODO•disable•this•button•when•the•contents•of•the•REPL↲ 	[original] line 282
		                                                                   	
		╚╚╚╚╚╚↲                                                            	[generated] line 143
		      ↲                                                            	[generated] subset
		                                          ↲                        	
		╚╚╚╚╚╚╚matches•the•expected•end•result•-->↲                        	[original] line 283
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
                        <button class="show" onclick={() => completed ? reset() : complete()}>                                              {/** 
----------------------------------------------------------------# Line 144 #----------------------------------------------------------------
		╚╚╚╚╚╚<button•class="show"•onclick={()•=>•completed•?•reset()•:•complete()}>↲    	[generated] line 144
		╚╚╚╚╚╚<button•c    ="show"•on:    ={()•=>•completed•?•reset()•:•complete()}>↲    	
		╚╚╚╚╚╚<button•c    ="show"•on:     = {()•=>•completed•?•reset()•:•complete()} >↲ 	
		╚╚╚╚╚╚<button•class="show"•on:click="{()•=>•completed•?•reset()•:•complete()}">↲ 	[original] line 284
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
							{completed ? 'Reset' : 'Show me'}
						</button>
                    </> : <></>}                                                                                                            {/** 
----------------------------------------------------------------# Line 147 #----------------------------------------------------------------
		╚╚╚╚╚</>•:•<></>}↲ 	[generated] line 147
		╚╚╚╚╚{           ↲ 	
		╚╚╚╚╚{    ↲        	
		╚╚╚╚╚{/if}↲        	[original] line 287
-------------------------------------------------------------------------------------------------------------------------------------------- */} 

                    {(selected.next) ? <>                                                                                                   {/** 
----------------------------------------------------------------# Line 149 #----------------------------------------------------------------
		╚╚╚╚╚{(selected.next)•?•<>↲ 	[generated] line 149
		╚╚╚╚╚{ selected.next}     ↲ 	
		╚╚╚╚╚{    selected.next}↲   	
		╚╚╚╚╚{#if•selected.next}↲   	[original] line 289
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
                        <a class="next" href={`tutorial/${selected.next.slug}`}>Next</a>                                                    {/** 
----------------------------------------------------------------# Line 150 #----------------------------------------------------------------
		╚╚╚╚╚╚<a•class="next"•href={`tutorial/${selected.next.slug}`}>Next</a>↲ 	[generated] line 150
		╚╚╚╚╚╚<a•c    ="next"•h   =  tutorial/ {selected.next.slug}" >Next</a>↲ 	
		╚╚╚╚╚╚<a•c    ="next"•h   = tutorial/{selected.next.slug}">Next</a>↲    	
		╚╚╚╚╚╚<a•class="next"•href="tutorial/{selected.next.slug}">Next</a>↲    	[original] line 290
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
                    </> : <></>}                                                                                                            {/** 
----------------------------------------------------------------# Line 151 #----------------------------------------------------------------
		╚╚╚╚╚</>•:•<></>}↲ 	[generated] line 151
		╚╚╚╚╚{           ↲ 	
		╚╚╚╚╚{    ↲        	
		╚╚╚╚╚{/if}↲        	[original] line 291
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
				</div>

                <div class="improve-chapter">                                                                                               {/** 
----------------------------------------------------------------# Line 154 #----------------------------------------------------------------
		╚╚╚╚<div•class="improve-chapter">↲ 	[generated] line 154
		╚╚╚╚<div•c    ="improve-chapter">↲ 	
		╚╚╚╚<div•class="improve-chapter">↲ 	[original] line 294
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
                    <a class="no-underline" href={improve_link}>Edit this chapter</a>                                                       {/** 
----------------------------------------------------------------# Line 155 #----------------------------------------------------------------
		╚╚╚╚╚<a•class="no-underline"•href={improve_link}>Edit•this•chapter</a>↲ 	[generated] line 155
		╚╚╚╚╚<a•c    ="no-underline"•h   ={improve_link}>Edit•this•chapter</a>↲ 	
		╚╚╚╚╚<a•class="no-underline"•href={improve_link}>Edit•this•chapter</a>↲ 	[original] line 295
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
				</div>
			</div>
		</div>

        <div class="tutorial-repl">                                                                                                         {/** 
----------------------------------------------------------------# Line 160 #----------------------------------------------------------------
		╚╚<div•class="tutorial-repl">↲ 	[generated] line 160
		╚╚<div•c    ="tutorial-repl">↲ 	
		╚╚<div•class="tutorial-repl">↲ 	[original] line 300
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
			<Repl
                {...__sveltets_ensureType(Repl, repl)}                                                                                      {/** 
----------------------------------------------------------------# Line 162 #----------------------------------------------------------------
		╚╚╚╚{...__sveltets_ensureType(Repl,•repl)}↲ 	[generated] line 162
		╚╚╚╚                                repl} ↲ 	
		╚╚╚╚           repl}↲                       	
		╚╚╚╚bind:this={repl}↲                       	[original] line 302
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
				workersUrl="workers"
                svelteUrl={svelteUrl}                                                                                                       {/** 
----------------------------------------------------------------# Line 164 #----------------------------------------------------------------
		╚╚╚╚svelteUrl={svelteUrl}↲ 	[generated] line 164
		╚╚╚╚          {svelteUrl}↲ 	
		╚╚╚╚{svelteUrl}↲           	[original] line 304
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
                rollupUrl={rollupUrl}                                                                                                       {/** 
----------------------------------------------------------------# Line 165 #----------------------------------------------------------------
		╚╚╚╚rollupUrl={rollupUrl}↲ 	[generated] line 165
		╚╚╚╚          {rollupUrl}↲ 	
		╚╚╚╚{rollupUrl}↲           	[original] line 305
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
				orientation={mobile ? 'columns' : 'rows'}
				fixed={mobile}
                                                                                                                                            {/** 
----------------------------------------------------------------# Line 168 #----------------------------------------------------------------
		╚╚╚╚↲                          	[generated] line 168
		╚╚╚╚                         ↲ 	
		╚╚╚╚on:change={handle_change}↲ 	[original] line 308 (rest generated at line 171)
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
				injectedJS={mapbox_setup}
				relaxed
            />{__sveltets_instanceOf(Repl).$on('change', handle_change)}                                                                    {/** 
----------------------------------------------------------------# Line 171 #----------------------------------------------------------------
		╚╚╚/>{__sveltets_instanceOf(Repl).$on('change',•handle_change)}↲ 	[generated] line 171
		                                   on('change',•handle_change)}  	[generated] subset
		                                   on: change=  handle_change}   	
		    on:change= handle_change}                                    	
		╚╚╚╚on:change={handle_change}↲                                   	[original] line 308 (rest generated at line 168)
		                                                                 	
		╚╚╚/>{__sveltets_instanceOf(Repl).$on('change',•handle_change)}↲ 	[generated] line 171
		╚╚╚/>{__sveltets_instanceOf(Repl).$                            ↲ 	[generated] subset
		╚╚╚/>                                                          ↲ 	
		╚╚╚/>↲                                                           	[original] line 311
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
		</div>
	</div>

    {(mobile) ? <>                                                                                                                          {/** 
----------------------------------------------------------------# Line 175 #----------------------------------------------------------------
		╚{(mobile)•?•<>↲ 	[generated] line 175
		╚{ mobile}     ↲ 	
		╚{    mobile}↲   	
		╚{#if•mobile}↲   	[original] line 315
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
        <ScreenToggle offset={offset} labels={['tutorial', 'input', 'output']}/>                                                            {/** 
----------------------------------------------------------------# Line 176 #----------------------------------------------------------------
		╚╚<ScreenToggle•offset={offset}•labels={['tutorial',•'input',•'output']}/>↲ 	[generated] line 176
		╚╚<ScreenToggle•        offset •labels={['tutorial',•'input',•'output']}/>↲ 	
		╚╚<ScreenToggle•     offset•labels={['tutorial',•'input',•'output']}/>↲     	
		╚╚<ScreenToggle•bind:offset•labels={['tutorial',•'input',•'output']}/>↲     	[original] line 316
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
    </> : <></>}                                                                                                                            {/** 
----------------------------------------------------------------# Line 177 #----------------------------------------------------------------
		╚</>•:•<></>}↲ 	[generated] line 177
		╚{           ↲ 	
		╚{    ↲        	
		╚{/if}↲        	[original] line 317
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
</div></>);                                                                                                                                 {/** 
----------------------------------------------------------------# Line 178 #----------------------------------------------------------------
		</div></>);↲ 	[generated] line 178
		</div>       	[original] line 318
-------------------------------------------------------------------------------------------------------------------------------------------- */} 
return { props: {slug: slug , chapter: chapter}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}
