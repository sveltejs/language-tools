<script lang="ts">
    import type Foo from 'somewhere';
    interface ReferencesGeneric {
        a: A;
    }
    interface ReferencedByGeneric {
        b: true;
        f: Foo;
    }
    
    type A = $$Generic;
    type B = $$Generic<ReferencedByGeneric>;

    export let a: ReferencesGeneric;
    export let b: B;
</script>
