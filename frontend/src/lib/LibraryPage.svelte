<script>
	import { Library } from 'dlonwebjs';
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import {systemSettings,userSettings,translations} from "$lib/utils/store"
	let projects = $state([]);
	let loaded = $state(false);
  let L = $state()
	onMount(async () => {
		let data =   await Library.load_data()
    Object.keys(data["projects"]).map(p => {

      projects.push({pkey:p,...data["projects"][p]})
    })
    //projects = data["projects"]
    console.log(projects)
    L = userSettings.language
		loaded = true;
	});

</script>


	
<div class="container px-2 py-2" id="feature1-grid">
 
 
  <div class="col-lg-10 mx-auto">
    <h3 class=" border-bottom">Model Library</h3>
{#if loaded}



{#each  projects as project }
  
{#if project}
<div class="container my-4">
  <!-- Project header -->
  <div class="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
    <div>
      <h1 class="h3 mb-1 text-secondary">{project.title}</h1>
      
      {#if project.about[$userSettings.language]}
        <p class="text-body-secondary mb-0">{project.about[$userSettings.language]}</p>
      {/if}
    </div>
    {#if project.website}
      <a class=""
         href={project.website}
         target="_blank" rel="noopener">
         {$translations.website}
        
      </a>
    {/if}
  </div>

  <!-- Models grid -->
 
    {#each Object.entries(project.models || {}) as [key, cfg], i}
    {#if cfg.active}
  
    <div class="card h-100">
      <div class="card-body">

        <div class="d-flex">

        <div class="p-2 flex-grow-1">
           <h2 class="h4 card-title">  
            {#if cfg.images?.icon}
            <img src={cfg.images.icon} alt="icon" width="32" height="32" class="rounded border"/>
          {/if}   
            { cfg.title[$userSettings.language ]}</h2>
        </div>
        <div class="p-2">
          <span class="badge text-bg-secondary">
          {(cfg.type || '—').replace('_', ' ')}
        </span>
      </div>
        <div class="p-2"> <a href={"/inference/"+project.pkey+"."+key} >
          { $translations.use_model}
        </a></div>
        </div>


        <p class="card-text">{cfg.description[$userSettings.language]}</p>

        <ul class="list-unstyled small mb-3">
          <li><strong>{  $translations.model_input} :</strong> {cfg.model_input?.join(', ') ?? '—'}</li>
          <li><strong>{  $translations.model_output} :</strong> { $translations["model_output_"+cfg.model_output]}</li>
        </ul>

      
        
        <details class="p-2 mb-2">
          <summary>{ $translations.model_example}</summary>
            <!-- Examples -->  
            <div class="row g-2 align-items-center">
              {#if cfg.images?.input}
              <div class="col-6">
                <div class="ratio ratio-4x3 bg-light border d-flex align-items-center justify-content-center">
                 
                    <img src={cfg.images.input} alt="input example" class="img-fluid w-100 h-100" style="object-fit:cover;"/>
                
                  
                 
                </div>
                <div class="small text-center mt-1">{$translations.model_input}</div>
              </div>
              {/if}

              <div class="col-6">
                <div class="ratio ratio-4x3 bg-light border d-flex align-items-center justify-content-center">
                  {#if cfg.images?.output}
                    <img src={cfg.images.output} alt="output example" class="img-fluid w-100 h-100" style="object-fit:cover;"/>
                 
                  {/if}
                </div>
                <div class="small text-center mt-1"> {$translations.model_output} </div>
              </div>
            </div>

          

    
        </details>


      </div>
      <div class="row g-3">

     
     
   

    
    </div>
      </div>


      {/if}
    {/each}
 
</div>
{:else}
<div class="alert alert-secondary">No project data available</div>
{/if}
{/each}

{/if}


</div>

  
  
</div>
