<script lang="ts">
    const A = 'a';
    const B = 'b', C = 'c';
    interface ComponentEvents {
        /**
         * Some doc
         */
        [A]: boolean;
        [B]: string;
        [C];
    }
</script>