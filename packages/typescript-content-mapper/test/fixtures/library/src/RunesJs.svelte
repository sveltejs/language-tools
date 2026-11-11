<script>
    /** @type {{ name: string, size?: number, onclick?: () => void }} */
    let { name, size = 1, onclick } = $props();

    /** @param {number} by */
    export function grow(by) {
        size += by;
    }
</script>

<button {onclick} style:font-size="{size}em">{name}</button>
