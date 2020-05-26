<script>
	import { readable } from 'svelte/store';
	const store = readable(Promise.resolve('test'), () => {});
</script>

{#await $store}
	<p>loading</p>
{:then data}
	{data}
{/await}