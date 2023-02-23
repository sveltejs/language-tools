<script lang="ts">
    import { formatDate } from './util';

    formatDate(new Date());

    function foo() {
        formatDate(new Date())
    }

    foo()
</script>

{formatDate(new Date())}