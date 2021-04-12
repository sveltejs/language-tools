<script>
	$$slots;
	$$restProps;
	$$props;
	$: foo = {...$$slots, ...$$restProps, ...$$props};
</script>

{#if $$slots.foo}
	{$$restProps.bar}
	<Component 
		{...$$props}
	/>
{/if}