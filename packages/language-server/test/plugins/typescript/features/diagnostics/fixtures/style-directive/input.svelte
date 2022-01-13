<script lang="ts">
	let right = 'string';
	let wrong = true;
</script>

<!-- ok -->
<div style:right />
<div style:right={right} />
<div style:right="right" />
<div style:right={`right${right}`} />
<div style:right=right{right} />

<!-- error -->
<div style:wrong />
<div style:wrong={wrong} />
