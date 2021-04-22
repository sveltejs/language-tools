<><Component
    unshadowed1={unshadowed1}
    foo={unshadowed2}
    subthing={subthing}
    shadowed1={shadowed1}
    _shadowed2={shadowed2}
    complex={` ${complex} `}
    
    
    
    
>{() => {/*Ωignore_startΩ*/const Ψsubthing=subthing,Ψshadowed1=shadowed1,Ψ_shadowed2=shadowed2,Ψcomplex=(" ") + (complex) + (" ");/*Ωignore_endΩ*/() => { let {name:n, shadowed1, shadowed2, subthing} = /*Ωignore_startΩ*/new Component({target: __sveltets_any(''), props: {unshadowed1:unshadowed1, foo:unshadowed2, subthing:Ψsubthing, shadowed1:Ψshadowed1, _shadowed2:Ψ_shadowed2, complex:Ψcomplex}})/*Ωignore_endΩ*/.$$slot_def['default'];<>
    {() => { let {subthing} = /*Ωignore_startΩ*/new Component({target: __sveltets_any(''), props: {unshadowed1:unshadowed1, foo:unshadowed2, subthing:Ψsubthing, shadowed1:Ψshadowed1, _shadowed2:Ψ_shadowed2, complex:Ψcomplex}})/*Ωignore_endΩ*/.$$slot_def['sub1'];<><p  >{thing}{subthing}</p></>}}
    
    {() => { let {subthing, othersubthing} = /*Ωignore_startΩ*/new Component({target: __sveltets_any(''), props: {unshadowed1:unshadowed1, foo:unshadowed2, subthing:Ψsubthing, shadowed1:Ψshadowed1, _shadowed2:Ψ_shadowed2, complex:Ψcomplex}})/*Ωignore_endΩ*/.$$slot_def['sub2'];<><Sub  subthing={subthing}  >{thing}{subthing}</Sub></>}}
    
    <Sub subthing={subthing}  >{() => {/*Ωignore_startΩ*/const Ψsubthing=subthing;/*Ωignore_endΩ*/() => { let {subthing, othersubthing} = /*Ωignore_startΩ*/new Sub({target: __sveltets_any(''), props: {subthing:Ψsubthing}})/*Ωignore_endΩ*/.$$slot_def['default'];<>{thing}{subthing}</>}}}</Sub>
</>}}}</Component></>