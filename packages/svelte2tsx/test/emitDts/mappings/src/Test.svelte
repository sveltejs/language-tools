<script lang="ts">
    // offsets the declarations from where svelte2tsx emits them

    export let foo: string;

    export function greet(greeting: string) {
        return `${greeting} ${foo}`;
    }
</script>

{foo}
