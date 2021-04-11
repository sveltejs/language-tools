<script>
	export let prop
	$: foo = prop;
	$: bar = $prop;
	$: if (bar) ++foo
	$: { if (foo) bar(); }
</script>