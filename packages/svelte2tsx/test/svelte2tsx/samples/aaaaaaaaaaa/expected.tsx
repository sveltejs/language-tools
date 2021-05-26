///<reference types="svelte" />
<></>;
import { spring } from 'svelte/motion';
function render() {

  

   let count;

  const displayed_count = spring()/*Ωignore_startΩ*/;let $displayed_count = __sveltets_store_get(displayed_count);/*Ωignore_endΩ*/;
  ;() => {$: displayed_count.set(count);}
  let  offset = __sveltets_invalidate(() => modulo((__sveltets_store_get(displayed_count), $displayed_count), 1));

  function modulo(n, m) {
    // handle negative numbers
    return ((n % m) + m) % m;
  }
;
() => (<>

<div class="counter">
  <button
    onclick={() => (count -= 1)}
    aria-label="Decrease the counter by one"
  >
    <svg aria-hidden="true" viewBox="0 0 1 1">
      <path d="M0,0.5 L1,0.5" />
    </svg>
  </button>

  <div class="counter-viewport">
    <div
      class="counter-digits"
      style={`transform: translate(0, ${100 * offset}%)`}
    >
      <strong style="top: -100%" aria-hidden="true"
        >{Math.floor((__sveltets_store_get(displayed_count), $displayed_count) + 1)}</strong
      >
      <strong>{Math.floor((__sveltets_store_get(displayed_count), $displayed_count))}</strong>
    </div>
  </div>

  <button
    onclick={() => (count += 1)}
    aria-label="Increase the counter by one"
  >
    <svg aria-hidden="true" viewBox="0 0 1 1">
      <path d="M0,0.5 L1,0.5 M0.5,0 L0.5,1" />
    </svg>
  </button>
</div>

</>);
return { props: {count: count}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render()))) {
}