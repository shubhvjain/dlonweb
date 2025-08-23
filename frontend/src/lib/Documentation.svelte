<script>
  import Md from "./utils/MD.svelte";
  let {topic}= $props();

  const all_topics = {
    "inference":`Infer`,
    "training":`Train`,
    "convert":`Convert`,
    "settings":`Settings`
  }

  let selected_text = $derived(all_topics[topic])

</script>
{#if topic}  
    {#if topic === 'inference'}
      <Md  markdown={all_topics.inference}/>
    {:else if topic === 'training'}
      <Md  markdown={all_topics.training}/>
    {:else if topic === 'convert'}
      <Md  markdown={all_topics.convert}/>
    {:else if topic === 'settings'}
      <Md  markdown={all_topics.settings}/>
    {:else}
      <p>Documentation for <strong>{topic}</strong> is not available.</p>
    {/if}
{/if}

