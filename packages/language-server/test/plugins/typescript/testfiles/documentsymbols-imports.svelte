<script context="module" lang="ts">
  import { moduleValue } from './documentsymbols-imports-module';

  export const answer = moduleValue;
</script>

<script lang="ts">
  import DefaultComponent from './documentsymbols-imports-component.svelte';
  import * as utils from './documentsymbols-imports-utils';
  import { value, original as renamed } from './documentsymbols-imports-values';
  import type { Options } from './documentsymbols-imports-types';
  import type * as Types from './documentsymbols-imports-types';
  import legacy = require('./documentsymbols-imports-legacy');

  const local = value;
  function run(): Options | Types.Options | undefined {
    return undefined;
  }
</script>

<DefaultComponent>{local}{renamed}{utils.value}{legacy.value}</DefaultComponent>
