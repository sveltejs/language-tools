<Parent bare {shorthand} text1=val1 text2="val2" text3="a{a}b{b}" textEmpty="" literal={true} strLiteral={'foo'} complex={{a}} a-dashed-complex={{a}} --custom-cssprop="foo" let:foo>
    <Component slot="named" let:bar>
        {foo} {bar}
    </Component>
    <div>
        {foo}
    </div>
</Parent>
