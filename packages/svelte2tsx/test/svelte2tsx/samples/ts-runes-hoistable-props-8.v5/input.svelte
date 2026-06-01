<script module>
</script>

<script lang="ts">
type A = {
    Abc: A
}

let {Abc}: A = $props()
</script>