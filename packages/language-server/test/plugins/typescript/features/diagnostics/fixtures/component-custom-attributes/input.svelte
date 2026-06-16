<script lang="ts">
    import { Comp } from './components';
</script>

<!-- valid: declared custom attributes -->
<Comp mochi:defer />
<Comp mochi:hydrate:visible={{ rootMargin: '200px' }} someOtherProps="foo" />

<!-- invalid: declared custom attribute with wrong value type -->
<Comp mochi:hydrate:visible="oops" />

<!-- invalid: undeclared custom (namespaced) attribute -->
<Comp mochi:typo />

<!-- invalid: regular prop still validated against the component's own props -->
<Comp someOtherProps={123} />
<Comp unknownProp="x" />
