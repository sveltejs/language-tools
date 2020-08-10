<script lang="ts">
    interface ComponentDef<T> {
        props: {items: T[]}
        events: {select: CustomEvent<T>}
        slots: {item: T}
    }
</script>