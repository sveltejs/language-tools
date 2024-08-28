<script lang="ts">
	import MyComponent from './ComponentB.svelte'
	let value: Date
	$: console.log('value:', value)
</script>
  
<MyComponent bind:value />