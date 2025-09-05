<!-- Model Renderer.svelte -->
<script>
  import { onMount } from 'svelte';
  import { translations, userSettings } from '$lib/utils/store.js';
  import { Library } from 'dlonwebjs';

let  {name} =  $props(); 
let model = $state()
let loaded = $state(false)

$effect((type,data)=>{
  load_model()
})

const load_model = async()=>{
loaded = false

loaded = true
}

onMount(async () => {
  load_model()
});

</script>
{#if loaded}
{/if}