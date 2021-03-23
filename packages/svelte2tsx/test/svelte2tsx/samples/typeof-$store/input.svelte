<script lang="ts">
	import {writable} from "svelte/store";
	const foo = writable(1);
	type Foo = typeof $foo;
</script>