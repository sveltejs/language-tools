<script lang="ts">
	import BindChild from '../BindChild.svelte';
	import { child } from '../importer';
	import { child as child2 } from '../importer.js';
	import { onMount } from 'svelte';
</script>

<BindChild value={1} />{child}{child2}{onMount}
