<script lang="ts">
	import type { Readable } from 'svelte/store';

	let data: Readable<boolean>; // Svelte allows the store to be initialized later
	$data;
</script>

{$data}
