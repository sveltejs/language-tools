<script lang="ts">

    interface $$Props {
        exported1: string;
        exported2?: boolean;
        exported3: number;
        exported4?: 'foo';
        exported5?: '1';
        exported6?: '2';
    }

    export let exported1;
    export let exported2 = true;
    export let exported3: number;
    export let exported4: 'foo' = 'foo';
    export let exported5: '1' = '1', exported6 = '2';
</script>
