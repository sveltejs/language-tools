<script>
    import ImportTs from '../props_to-import-ts.svelte';
    import ImportJs from '../props_to-import-js.svelte';
</script>

<!-- errors: -->
<ImportTs />
<ImportTs required={'a'} optional1={'b'} optional2={'c'} doesntExist={true} />
<ImportTs required={true} optional1={true} optional2={true} />
<ImportJs />
<ImportJs required={true} optional1={true} optional2={true} />

<!-- valid: -->
<ImportTs required={'a'} />
<ImportTs required={undefined} />
<ImportTs required={'a'} optional1={'b'} optional2={'c'} />
<ImportTs required={'a'} optional1={'b'} optional2={undefined} />
<ImportJs required={'a'} />
<ImportJs required={undefined} />
<ImportJs required={'a'} optional1={'b'} optional2={'c'} />
<ImportJs required={'a'} optional1={'b'} optional2={undefined} />
