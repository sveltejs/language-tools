<script lang="ts">
    type Options = { direction: 'in' | 'out' | 'both' };
    function three(_node: HTMLElement, _params: { delay: number }, _options: Options) {
        return {};
    }
    function two(_node: HTMLElement, _params: { delay: number }) {
        return {};
    }
    function optionalThird(_node: HTMLElement, _params: { delay: number }, _options?: Options) {
        return {};
    }
    function four(_node: HTMLElement, _params: { delay: number }, _options: Options, _extra: string) {
        return {};
    }
    function wrongOptions(_node: HTMLElement, _params: { delay: number }, _options: number) {
        return {};
    }
</script>

<!-- fine: Svelte passes the options as the third argument -->
<div in:three={{ delay: 1 }} />
<div in:two={{ delay: 1 }} />
<div in:optionalThird={{ delay: 1 }} />
<!-- errors -->
<div in:three={{ delay: 'no' }} />
<div in:four={{ delay: 1 }} />
<div in:doesNotExist={{ delay: 1 }} />
<div in:wrongOptions={{ delay: 1 }} />
