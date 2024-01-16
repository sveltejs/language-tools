<script lang="ts">
  import { 
    Component,
    OtherComponent,
    ComponentWithFunction1,
    ComponentWithFunction2,
    ComponentWithGeneric
  } from './components';

  let element: HTMLInputElement;
  let component: Component;
  let otherComponent: OtherComponent;
  let componentWithFunction1: ComponentWithFunction1;
  let componentWithFunction2: ComponentWithFunction2;
  let componentWithGeneric: ComponentWithGeneric<string>;

  // element not read -> error
  // used before being assigned (allowed only after on mount)
  component;

  $: otherComponent && console.log('foo');
  function callback() {
    otherComponent;
    componentWithFunction1;
    componentWithFunction2;
    componentWithGeneric;
  }
  callback();
</script>

<!-- correct -->
<input bind:this={element} />
<Component prop={true} bind:this={component} />
<ComponentWithFunction1 bind:this={componentWithFunction1} />
<ComponentWithFunction2 bind:this={componentWithFunction1} />
<ComponentWithGeneric prop={''} bind:this={componentWithGeneric} />
<svelte:component this={Component} bind:this={component} prop={true} />
<svelte:component this={Math.random() > 0.5 ? Component : null} bind:this={component} prop={true} />

<!-- errors -->
<div bind:this={element} />
<Component prop={true} bind:this={otherComponent} />
<ComponentWithFunction1 bind:this={componentWithFunction2} />
<svelte:component this={Component} bind:this={otherComponent} />

<!-- only throws an error with new transformation -->
<ComponentWithGeneric prop={true} bind:this={componentWithGeneric} />
<svelte:component this={Component} bind:this={component} />
