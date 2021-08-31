<script lang="ts">
    type T = $$Generic<boolean>;
    interface $$Props {
        a: T;
    }
    interface $$Events {
        b: CustomEvent<T>;
    }
    interface $$Slots {
        default: { c: T };
    }
</script>
