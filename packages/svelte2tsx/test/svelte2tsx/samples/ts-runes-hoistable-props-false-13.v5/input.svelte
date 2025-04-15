<script module>
    namespace A {
        export type Abd = number
    }
</script>

<script lang="ts">
interface A {
    Abc: number
}

let {Abc}: A = $props()
</script>