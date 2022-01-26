<script lang="ts">
    import Form from './Form.svelte';

    type TValues = $$Generic;

    export let values: TValues;
</script>

<Form
    {values}
    let:errors
>
    <slot {errors} />
</Form>