<script lang="ts">
    import DefaultSvelteWithTS from 'package';
    import SubWithDTS from 'package/x';
    import SubWithoutDTSAndNotTS from 'package/y';
</script>

<DefaultSvelteWithTS />
<SubWithDTS />
<SubWithoutDTSAndNotTS />
