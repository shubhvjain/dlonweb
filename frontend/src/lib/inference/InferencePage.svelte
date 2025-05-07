<script>
	import TiffViewer from "./TiffViewer.svelte";
  import {get_models_list}  from "$lib/dlonweb/models"
  import {get_input_types} from "$lib/dlonweb/io"
	import { onMount } from "svelte";
  let model_list = $state([])
  let model_data = $state({})
  let input_list =$state([])
  let loaded = $state(false)
  onMount(()=>{
    let data = get_models_list()
    model_list = data.list
    model_data  = data.details
    //console.log(model_list)
    input_list = get_input_types()
    loaded =  true
  })
</script>
{#if loaded}
<div class="p-2 p-md-4 mb-4 rounded border">
  <div class="col-lg-12 px-0">
    <h3 class="border-bottom">Inference</h3>

    <div class="pt-2 mt-2 mb-2 pb-2 d-flex justify-content-center">
      <div class="p-2">
        <h5>Model Selection</h5>
        <select class="form-select form-select-lg mt-2 mb-2" aria-label="Model type selection">
          <option selected>Select a model</option>
          {#each model_list as model }
            <option value="{model.value}">{model.name}</option>   
          {/each}
          <option value="custom">Use Your Own Tensorflow Model</option>
        </select>
      </div>
    
      <div class="p-2">
        <h5>Input selection</h5>
        <select class="form-select form-select-lg mt-2 mb-2" aria-label="Input type selection ">
          <option selected value="">Select input type</option>
          {#each input_list as ip }
          <option value="{ip.value}">{ip.name}</option>   
        {/each}
        </select>
      </div>
    
      <div class="p-2">
        <div class="p-2 m-1"></div>
        <button class="btn btn-lg btn-primary mt-2 mb-2">Run</button>
      </div>
    </div>
    <TiffViewer/> 
  </div>
</div>
{/if}