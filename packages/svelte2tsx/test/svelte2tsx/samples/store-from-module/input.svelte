<script context="module">
    import {store1, store2} from './store';
    const store3 = writable('');
    const store4 = writable('');
</script>

<script>
    $store1;
    $store3;
</script>

<p>{$store2}</p>
<p>{$store4}</p>