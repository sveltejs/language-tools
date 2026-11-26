<script module lang="ts">
const text=`hello ${1}
// @ts-ignore`;
export {default as Missing} from "./Missing.svelte";
</script>

{text}
