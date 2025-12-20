<script lang="ts" generics="T extends { a: string }">
    interface WithItems<T> {
        items: T[];
    }

	interface Props extends WithItems<T> {
		prop: T;
	};
	let { prop }: Props = $props();
</script>