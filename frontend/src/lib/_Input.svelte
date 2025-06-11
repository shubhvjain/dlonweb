<!-- this is to read input or any kind from the user. it returns appropriate input class -->
 <script>
  import {load_input} from "dlonwebjs"
	import Preview from "./_Preview.svelte";
 let  {input=$bindable(),input_valid=$bindable(false)} = $props()
 const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'];
 let error = $state('');

 async function handleFileChange(event) {
    const file = event.target.files[0];
    input = null;
    input_valid = false;
    error = '';

    if (!file) {
      error = 'No file selected.';
      return;
    }

    if (!allowedTypes.includes(file.type)) {
      error = 'Unsupported file type.';
      input_valid = false;
      return;
    }

    try {
      const result = await load_input(file);
      if (result) {
        input = result;
        input_valid = true;
      } else {
        error = 'Failed to load input.';
      }
    } catch (err) {
      input = null
      console.error(err);
      error = 'An error occurred while loading the file.';
    }
  }
 </script>
<div class="d-flex border-bottom1 mb-2">
  <div class="p-1 flex-grow-1"> 
    <h4 class={  input_valid?("text-success"):("text-danger") }> Input </h4>
  </div>
  <div class="p-2">   
    {#if input }
        {#if input_valid}
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-check2-circle text-success" viewBox="0 0 16 16">
          <path d="M2.5 8a5.5 5.5 0 0 1 8.25-4.764.5.5 0 0 0 .5-.866A6.5 6.5 0 1 0 14.5 8a.5.5 0 0 0-1 0 5.5 5.5 0 1 1-11 0"/>
          <path d="M15.354 3.354a.5.5 0 0 0-.708-.708L8 9.293 5.354 6.646a.5.5 0 1 0-.708.708l3 3a.5.5 0 0 0 .708 0z"/>
        </svg>
        {:else}
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-exclamation-circle text-danger" viewBox="0 0 16 16">
          <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
          <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0M7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0z"/>
        </svg>
        {/if}
    {:else}
        {#if error}
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-exclamation-circle text-danger" viewBox="0 0 16 16">
          <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
          <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0M7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0z"/>
        </svg>
        {/if}
    {/if}
  </div>
</div>
<div>
  <input id="file-upload" type="file" accept="image/*,video/*" onchange={handleFileChange} />
</div>
{#if error}
  <div class="alert alert-danger m-1">
    {error}
  </div>
{:else}
  {#if  input && input_valid}
    <Preview input={input} />
  {/if}
{/if}