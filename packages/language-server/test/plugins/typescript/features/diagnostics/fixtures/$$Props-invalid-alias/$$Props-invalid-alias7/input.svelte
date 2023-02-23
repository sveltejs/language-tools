<script lang="ts">
	interface ItemData {
		x: number;
		y: number;
	}

    interface ItemData2 extends ItemData {}

	type $$Props =
        ItemData2;

	export let x;
	export let y:string;
</script>
