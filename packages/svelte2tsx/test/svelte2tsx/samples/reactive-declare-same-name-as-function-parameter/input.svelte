<script>
const a = function (shadowed1) {}
const b = (shadowed2) => {}
$: c = function (shadowed3) {}
$: d = (shadowed4) => {}

$: shadowed1 = 1
$: shadowed2 = 1
$: shadowed3 = 1
$: shadowed4 = 1
</script>