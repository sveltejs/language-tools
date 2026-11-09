<script lang="ts">
    interface $$Props {
        /**
         * comment is preserved
         */
        label: string;
        disabled?: boolean;
    }
    interface $$Events {
        toggle: CustomEvent<boolean>;
    }
    interface $$Slots {
        default: { active: boolean };
    }

    export let label: string;
    export let disabled = false;
    let active = false;
</script>

<button {disabled} on:click={() => (active = !active)}>{label}</button>
<slot {active} />
