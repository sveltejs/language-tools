<script lang="ts">
    import Slots from './diagnostics-slots-imported.svelte';
</script>

<Slots let:defaultSlotProp prop={defaultSlotProp}>
  {defaultSlotProp === 1}
  {defaultSlotProp === false}
  <p slot="named" let:namedSlotProp class:namedSlotProp>
    {namedSlotProp === 1}
    {namedSlotProp === false}
    {defaultSlotProp}
  </p>
  {namedSlotProp}
</Slots>
