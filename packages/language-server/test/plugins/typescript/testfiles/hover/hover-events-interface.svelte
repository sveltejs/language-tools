<script lang="ts">
    interface ComponentEvents {
        a: CustomEvent<boolean>;
        /**
         * TEST
         ```ts
         const abc: boolean = true;
         ```
         */
        abc: MouseEvent;
        c;
    }
</script>