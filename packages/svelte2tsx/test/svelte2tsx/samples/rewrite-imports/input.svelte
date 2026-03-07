<script context="module">
    import foo1 from '../../foo';
    import('../../bar');
    export { x } from '../../x';

    /** @param {import('../../mhm'.mhm)} mhm */
    function f(mhm) {}
</script>

<script>
    import foo2 from '../../foo';
    import('../../bar');

    /** @type {import('../../mhm').mhm} */
    let mhm = true;

    /** @param {import('../../mhm'.mhm)} mhm */
    function f(mhm) {}
</script>

<button
    onclick={() => {
        import('../../bar');
        /** @type {import('../../mhm').mhm} */
        let mhm = true;
        /** @param {import('../../mhm').mhm} mhm */
        function f(mhm) {}
    }}
>click</button>
