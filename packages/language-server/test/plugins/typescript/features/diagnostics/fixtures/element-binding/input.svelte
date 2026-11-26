<script lang="ts">
	let v = '';
	let count = '';
	let checked = ''
</script>

<input
	type="checkbox"
	bind:checked={v}
/>

<p>text</p>

<details bind:open={count}>text</details>
<input type="checkbox" bind:checked={count} />
<input bind:checked type="checkbox" />