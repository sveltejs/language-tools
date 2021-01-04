<script lang="ts">
	interface A {
	  $bla: boolean;
	}

	type B = { $bla: boolean; }
  
	class C {
	  $bla: boolean;
	}
  </script>