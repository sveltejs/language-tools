<script lang="ts">
    import type { Foo } from './foo';
    export let foo: Foo;
    interface Bar1 {
        a: true;
    }
    interface Bar2 extends Bar1 {
        b: false;
    }
    interface Bar3 extends Bar1, Bar2 {
        c: false;
    }
    interface Bar4<T extends boolean> extends Bar1, Bar2 {
        c: false;
    }
    export let bar: Bar3;
</script>
