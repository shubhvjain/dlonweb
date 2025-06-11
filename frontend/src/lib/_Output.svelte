<script>
	import { onMount } from "svelte";
	import Preview from "./_Preview.svelte";
  let {output} = $props()
  onMount(async ()=>{
  })
</script>
<Preview  input={output} />