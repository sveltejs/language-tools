<script context="module">
    this.shouldNotBeTransformed;
    export async function notPreload() {
        this.shouldNotBeTransformed;
    }
</script>

<script>
    this.shouldNotBeTransformed;
    export async function preload() {
        this.shouldNotBeTransformed;
    }
</script>