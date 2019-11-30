<script>
 let name = Writable(null)
 let name2 = Writable(null)

let a = $name
let b = $name2

function test() {
    let $name = "reassigned";
    let c = $name
    let d = $name2
}
</script>