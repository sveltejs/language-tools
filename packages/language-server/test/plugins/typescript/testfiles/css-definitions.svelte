<script lang="ts">
  import { test } from "./main";
  let current = "foo";

  console.log(test);

  function dostuff() {
    console.log("a");
  }
</script>

<main>
  <p class="test test1" class:active={current === "foo"} on:click={dostuff}>Visit the <a href="https://svelte.dev/tutorial">Svelte tutorial</a> to learn how to build Svelte apps.</p>
</main>

<main>
  <p class={current === "baz" ? "selected" : ""}>Visit the <a href="https://svelte.dev/tutorial">Svelte tutorial</a> to learn how to build Svelte apps.</p>
</main>

<style>
  .test4 {
  }
  .test1 {
    text-align: center;
  }
  main {
    text-align: center;
    padding: 1em;
    max-width: 240px;
    margin: 0 auto;
  }

  h1 {
    color: #ff3e00;
    text-transform: uppercase;
    font-size: 4em;
    font-weight: 100;
  }

  @media (min-width: 640px) {
    main {
      max-width: none;
    }
  }

  .active {
    background-color: #ff3e00;
    color: white;
  }

  .selected {
    background-color: #ff3e00;
    color: white;
  }
</style>
