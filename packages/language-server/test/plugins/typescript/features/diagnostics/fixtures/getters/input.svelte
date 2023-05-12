<script lang="ts">
    import ComponentWithGetters from "./component-with-getters.svelte";
    const comp: ComponentWithGetters = null as any;
    comp.test();
    new comp.Foo();
    comp.bar === 'foo';
</script>
  