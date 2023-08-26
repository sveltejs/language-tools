<script lang="ts">
    function myTransition(
      _node: HTMLElement,
      _params: { delay: number },
      _context: { direction: 'in' | 'out' | 'both' }
    ) {
      return {};
    }
</script>

<div in:myTransition={{ delay: 100 }} />
