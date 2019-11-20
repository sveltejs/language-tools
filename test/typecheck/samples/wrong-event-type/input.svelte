<script>
	let count = 0;

	function handleClick(b: number) {
		count += b;
	}
</script>

<button on:click={handleClick}>
	Clicked {count} {count === 1 ? 'time' : 'times'}
</button>