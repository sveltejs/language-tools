<script lang="ts">
    export let prop: any;
    const defaultSlotProp = 1;
    const namedSlotProp = true;
</script>

{prop}
<slot {defaultSlotProp} />
<slot name="named" {namedSlotProp} />
