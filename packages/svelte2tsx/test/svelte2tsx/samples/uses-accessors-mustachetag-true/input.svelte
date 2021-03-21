<svelte:options accessors={true} />
<script lang="ts">
	export let foo: number = undefined
	export let foo2 = undefined
	let clazz: string
	export { clazz as class }
	export const bar: string = ''
</script>