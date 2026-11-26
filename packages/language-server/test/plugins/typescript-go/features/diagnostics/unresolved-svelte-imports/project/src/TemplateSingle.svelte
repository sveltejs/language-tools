<script module lang="ts">
const text=`hello ${1}`;
// @ts-expect-error
export {default as Missing} from "./Missing.svelte";
</script>

{text}
