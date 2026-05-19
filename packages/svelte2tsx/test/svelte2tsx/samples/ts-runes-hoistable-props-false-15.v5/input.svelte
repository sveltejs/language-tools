<script module>
</script>

<script lang="ts">
import { store } from './foo';
interface A {
    Abc: typeof store
}

let {Abc}: A = $props()
</script>