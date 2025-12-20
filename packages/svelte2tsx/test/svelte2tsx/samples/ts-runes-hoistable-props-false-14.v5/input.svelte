<script module>
    enum A {
    }
</script>

<script lang="ts">
interface A {
    Abc: number
}

let {Abc}: A = $props()
</script>