<!-- PreviewRenderer.svelte -->
<script>
  	import { onMount } from 'svelte';

  let  {type=$bindable(),data=$bindable()} =  $props();
  let loaded = $state(false)
  let url = $state(null);
  let textContent = $state(null);
  $effect((type,data)=>{
    console.log(type,data)
    load_media()
  })

const load_media = async()=>{
  console.log(type,data)
  
 
  if ((type === "image" || type === "video") && (data instanceof Blob || data instanceof File)) {
    url = null
    loaded = false  
      setTimeout(()=>{
        url = URL.createObjectURL(data);
        console.log("111")
        loaded = true
      },50)
      
    } else if (type === "text") {
      if (typeof data === "string") {
        textContent = data;
      } else if (data instanceof Blob || data instanceof File) {
        textContent = await data.text();
      }     
    }
   
}
  onMount(async () => {load_media()})
</script>
{#if loaded}
<div class=" text-center p-2">
  {#if type === "image" && url}
    <img src={url} class="img-fluid border rounded shadow-sm" alt="Preview" />
  
  {:else if type === "video" && url}
    <video controls class="border rounded shadow-sm">
      <source src={url} type="video/mp4" />
      <source src={url} type="video/webm" />
      Your browser does not support the video tag.
    </video>
  
  {:else if type === "text" && textContent}
    <div class="border rounded bg-light p-3 text-start">
      <pre class="mb-0" style="white-space: pre-wrap;">{textContent}</pre>
    </div>
  
  {:else}
    <div class="alert alert-warning">
      <i class="bi bi-exclamation-triangle-fill me-2"></i>
      Unsupported or empty preview.
    </div>
  {/if}
</div>
{/if}