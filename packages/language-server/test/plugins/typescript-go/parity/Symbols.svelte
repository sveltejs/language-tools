<script lang="ts" module>
	export const moduleConst = 1;
</script>

<script lang="ts">
	import BindChild from './BindChild.svelte';
	interface Item {
		id: number;
		name: string;
	}
	let items: Item[] = $state([]);
	let count = $state(0);
	function increment() {
		const step = 1;
		count += step;
	}
	const { a, b: renamed } = { a: 1, b: 2 };
	class Foo {
		bar() {}
	}
	items.forEach((item) => {
		const inCallback = item;
	});
</script>

{#each items as item}
	{@const label = item.name}
	<BindChild />{label}
{/each}
<button onclick={increment}>{count}</button>
