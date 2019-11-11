<script>
    let b = 7;
</script>
<div>
    <slot a={b} {b} c=b d="a{b}" e="{b}" >Hello</slot>
</div>
