<script module>
</script>

<script lang="ts">
interface A extends B<A> {
    Abc: A
    [key: string]: A
}

interface B<T> {}

let {Abc}: A = $props()
</script>