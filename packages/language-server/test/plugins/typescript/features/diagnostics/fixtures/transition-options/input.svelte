<script lang="ts">
    function myTransition(
      _node: HTMLElement,
      _params: { delay: number },
      _context: { direction: 'in' | 'out' | 'both' }
    ) {
      return {};
    }

    function deferredTransition(
      _node: HTMLElement,
      _params: { delay: number },
      _context: { direction: 'in' | 'out' | 'both' }
    ) {
      return (_options: { direction: 'in' | 'out' }) => ({ delay: 100 });
    }
</script>

<div in:myTransition={{ delay: 100 }} />
<div in:deferredTransition={{ delay: 100 }} />
