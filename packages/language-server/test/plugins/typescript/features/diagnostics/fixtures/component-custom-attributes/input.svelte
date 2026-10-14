<script lang="ts">
    import { Comp } from './components';
</script>

<!-- valid: declared custom attributes -->
<Comp custom:defer />
<Comp custom:hydrate:visible={{ rootMargin: '200px' }} someOtherProps="foo" />

<!-- invalid: declared custom attribute with wrong value type -->
<Comp custom:hydrate:visible="oops" />

<!-- invalid: undeclared custom (namespaced) attribute -->
<Comp custom:typo />

<!-- invalid: regular prop still validated against the component's own props -->
<Comp someOtherProps={123} />
<Comp unknownProp="x" />
