<script lang="ts">
    interface $$Slots {
        default: {
            a: number;
        },
        foo: {
            b: number
        }
    }
    let b = 7;
</script>

<div>
    <slot a={b} />
    <slot name="foo" {b} />
</div>
