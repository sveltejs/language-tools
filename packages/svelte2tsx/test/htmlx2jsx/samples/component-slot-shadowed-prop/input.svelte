<Component
    {unshadowed1}
    foo={unshadowed2}
    {subthing}
    {shadowed1}
    shadowed-2={shadowed2}
    templateString=" {complex} "
    complex="{{complex}}"
    let:name={n}
    let:shadowed1
    let:shadowed2
    let:subthing
>
    <p slot="sub1" let:subthing>{thing}{subthing}</p>
    <!-- subthing prop is defined by let:subthing on "Sub" -->
    <Sub slot="sub2" {subthing} let:subthing let:othersubthing>{thing}{subthing}</Sub>
    <!-- subthing prop is defined by let:subthing on "Component" -->
    <Sub {subthing} let:subthing let:othersubthing>{thing}{subthing}</Sub>
</Component>
