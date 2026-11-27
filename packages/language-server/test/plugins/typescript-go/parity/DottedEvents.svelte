<script lang="ts">
	import EventChild from './EventChild.svelte';
	const UI = { EventChild };
</script>

<EventChild on:abc={() => {}} />
<UI.EventChild on:abc={() => {}} />
