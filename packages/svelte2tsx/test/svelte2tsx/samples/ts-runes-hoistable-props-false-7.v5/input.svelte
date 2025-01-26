<script lang="ts">
	let { destructured } = {};
	type Props = {
		prop: typeof destructured;
	};
	let { prop }: Props = $props();
</script>