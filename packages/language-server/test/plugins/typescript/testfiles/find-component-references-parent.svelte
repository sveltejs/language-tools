<script script lang="ts">
  import Component1 from "./find-component-references-child.svelte";

  test();

  const theModule2 = import("./find-component-references-child.svelte");

  import("./find-component-references-child.svelte").then((module) => {
    new module.default({
      target: document.body as HTMLElement,
    });
  });

  async function test() {
    const theModule = await import("./find-component-references-child.svelte");
  }
</script>

<Component1 />

<Component1>
  <p>test</p>
  <p>test</p>
</Component1>
