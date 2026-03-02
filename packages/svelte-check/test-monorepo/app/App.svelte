<script lang="ts">
    import { Button } from '@test/shared/components';
</script>

<!-- Correct usage -->
<Button label="Click me" disabled={false} />

<!-- Error: label expects string, not number (TS2322) -->
<Button label={123} />
