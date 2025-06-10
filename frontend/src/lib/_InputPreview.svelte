<!-- This is to show preview for a input object. It takes an input object and shows a button which when clicked shows the input preview in the side bar  -->

<script>
	import { onMount } from "svelte";

  let {input} = $props()
  let rid = $state("")
  onMount(()=>{
    rid = "id-"+Math.floor(Math.random()*1000)
    if(input){

    }
    console.log("on mount preview")
  })
</script>

{#if input}
  <button class="btn btn-link">Preview</button>
{/if}
