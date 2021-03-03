<Parent let:foo let:bar={baz}>
    <Component slot="named" let:bla>
        {foo} {baz} {bla}
    </Component>
    <Component let:blubb>
        {blubb}
    </Component>
</Parent>
