<script lang="ts">
    let callback: (id: string) => void;
    let callback2: {( id: string): void}
    let constructor1: new (id: string) => { id: string };
    let obj: { hi(id: string): void }

    $: ({ id } = { id: '' });
</script>
