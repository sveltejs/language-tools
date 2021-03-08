<script>
	import Component from "foo";

	const { check, method1, method2 } = Component;
</script>
<Component on:click={$check ? method1 : method2} />
<button on:click={$check ? method1 : method2} >Bla</button>