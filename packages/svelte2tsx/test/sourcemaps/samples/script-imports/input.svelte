<script>
	import Repl from '@sveltejs/svelte-repl';
	import { getContext } from 'svelte';
	import ScreenToggle from '../../../components/ScreenToggle.svelte';
	import { 
		mapbox_setup, 
		rollupUrl, 
		svelteUrl 
	} from '../../../config';
	import TableOfContents from './_TableOfContents.svelte';
	const foo = 1;
</script>
<div>
	{foo}
</div>