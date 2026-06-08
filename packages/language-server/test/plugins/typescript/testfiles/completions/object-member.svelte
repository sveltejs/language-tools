<script lang="ts">
    interface SayHi {
        hi(name: string): string
    }

    const a: SayHi = {
        h
    }

    class A implements SayHi {
        h
    }

    function takeOptions(options: { bar: boolean; baz?: number }) {}
    takeOptions({ bar: false,  })
</script>