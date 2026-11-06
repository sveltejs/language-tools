<script lang="ts">
    import ClassComponent from './ClassComponent';
</script>

<ClassComponent name="name" on:change={(e) => e.detail.toUpperCase()} />
