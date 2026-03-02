<script lang="ts">
    export let label: string;
    export let disabled: boolean = false;
</script>

<button {disabled} on:click>{label}</button>
