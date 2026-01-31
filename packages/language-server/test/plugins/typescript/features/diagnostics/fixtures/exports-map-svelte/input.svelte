<script lang="ts">
    import DefaultSvelteWithTS from 'package'; // with https://github.com/sveltejs/language-tools/pull/2478 this would work; needs decision if we want that
    import SubWithDTS from 'package/x';
    import SubWithoutDTSAndNotTS from 'package/y';
</script>

<DefaultSvelteWithTS />
<SubWithDTS />
<SubWithoutDTSAndNotTS />
