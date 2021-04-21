<Parent propA {propB} propC=val1 propD="val2" propE="a{a}b{b}" let:foo>
    <Component slot="named" let:bar>
        {foo} {bar}
    </Component>
    <div>
        {foo}
    </div>
</Parent>
