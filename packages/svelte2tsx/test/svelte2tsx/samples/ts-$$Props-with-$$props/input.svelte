<script lang="ts">
    interface $$Props {
        /**
         * comment
         */
         a: boolean;
         b?: string;
    }
    export function c() {}
</script>
<!-- using $$props while using $$Props shouldn't widen the props type allow any prop -->
{$$props}
