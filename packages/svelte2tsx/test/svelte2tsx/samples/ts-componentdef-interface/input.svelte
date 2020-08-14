<script lang="ts">
    interface ComponentDef {
        props: {items: any[]}
        events: {select: CustomEvent<number>}
        slots: {item: any}
    }
</script>