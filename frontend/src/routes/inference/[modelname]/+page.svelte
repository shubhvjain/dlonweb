<script>
	import InferenceTaskPage from '$lib/InferencePage.svelte';
  import { Library } from 'dlonwebjs';
	// import { page } from '$app/stores';
  let { data } = $props();
	import { onMount } from 'svelte';
	let modelName = $state('');
	let loaded = $state(false);
  const load_page = ()=>{
    try {
      //console.log("loading +page....")
      loaded = false
      modelName = data.modelName
		  //console.log('Loaded model:', modelName);
      if(modelName){
        setTimeout(()=>{
          loaded = true;   
        },5)
      }
    } catch (error) {
      console.log(error) 
      loaded = false
    }
  }

  $effect(()=>{
    load_page()
  })

	onMount(async () => {
   load_page()
	});
</script>

{#if loaded}
	<InferenceTaskPage {modelName} />
{/if}
