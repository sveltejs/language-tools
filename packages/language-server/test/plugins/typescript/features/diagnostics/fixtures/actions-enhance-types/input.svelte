<script lang="ts">
    function action(node: any) {
        node;
        return {
            // TODO: replace this with the Svelte interface generic once it lands in Svelte
            $$_attributes: {
                foo: 'string',
                'on:bar': (e: CustomEvent<boolean>) => {e;}
            }
        }
    }

    function onBar(e: CustomEvent<boolean>) {
        e;
    }

    function onWrongBar(e: CustomEvent<string>) {
        e;
    }
</script>

<!-- valid for new transformation -->
<div use:action foo="valid" on:bar={onBar} />

<!-- invalid -->
<div use:action foo={1} on:bar={onBar} />
<div use:action foo="valid" on:bar={onWrongBar} />
