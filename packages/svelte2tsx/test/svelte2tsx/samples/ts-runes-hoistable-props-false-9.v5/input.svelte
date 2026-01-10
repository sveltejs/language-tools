<script lang="ts" generics="T extends { a: string }">
	interface Props extends T {
	};
	let { a }: Props = $props();
</script>