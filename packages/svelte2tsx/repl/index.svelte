<!-- <svelte:options /> -->
<!-- <svelte:options accessors /> -->
<!-- <svelte:options accessors={true} /> -->
<!-- <svelte:options accessors={false} /> -->

<svelte:options accessors={true} />

<script lang="ts">

    // getter & setter (only if accessors: true)
	export let accProp1: number = undefined
	export let accProp2: string = undefined
	export let accProp3: boolean = undefined

    // readonly / only getter (always, no matter if accessors: true / false)
    export const gettableProp1 :number = undefined
    export const gettableProp2 :string = undefined
    export const gettableProp3 :boolean = undefined

</script>