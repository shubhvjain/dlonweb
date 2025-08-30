<script>
	import { onMount } from 'svelte';
	import Preview from './_Preview.svelte';
	let { output } = $props();
	let details = $state({ files: 0, time: 0 });
	let loaded = $state(false);
	import { translations, userSettings } from '$lib/utils/store.js';
	import JSZip from 'jszip';

	import PreviewRenderer from './utils/PreviewRenderer.svelte';

	let preview_data = $state({})
	let show_loader = $state(false);
	let key_selected = $state("");
	let loaded_selected= $state(false)
	let preview_item = $state()
	let selected_type = $state()
	onMount(async () => {
		if (output) {
			console.log(output);
			details.time = Math.round(
				Object.values(output['run_times']).reduce((a, b) => a + b, 0) / 1000
			);
			details.files = output['input_data_obj']['filelist'].length;
			preview_data = await output.generate_outputs()
			console.log(preview_data)
			loaded = true;
		}
	});

	
	const select_item= (key)=>{
		console.log(key)
		loaded_selected = false
		preview_item = preview_data.items.find(it=>{return it.key==key})
		key_selected = key
		console.log(preview_item)
		loaded_selected = true
	}


  // track created Object URLs for cleanup
  const urls = new Set();
  const makeURL = (fileOrBlob) => {
		console.log(fileOrBlob)
    if (!fileOrBlob) return "";
    const u = URL.createObjectURL(fileOrBlob);
    urls.add(u);
    return u;
  };
  const cleanupURLs = () => {
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls.clear();
  };

	const iconForType = (t) => {
    if (!t) return "📎";
    if (t.startsWith("image")) return "🖼️";
    if (t.startsWith("video")) return "🎥";
    if (t.startsWith("text")) return "📄";
    return "📎";
  };


	async function  download() {

		
		

		if(!preview_data.downloads[selected_type]){
			throw new Error("Invalid selection")
		}
		const zip = new JSZip();
		let files = preview_data.downloads[selected_type]
		//console.log(files)
		  // Add files to the zip
			for (let file of files) {
				//console.log(typeof file)
    //const data = await file.arrayBuffer(); // read file
    zip.file(file.name,file);
  }

  // Generate the zip
  const content = await zip.generateAsync({ type: "blob" });

  // Create a download link
  const a = document.createElement("a");
  a.href = URL.createObjectURL(content);
  a.download = "files.zip";
  a.click();
  URL.revokeObjectURL(a.href); // cleanup
  }


</script>

<!-- <Preview  input={output} /> -->

{#if loaded}
	<div class="card">
		<div class="card-header d-flex">
			<div class="flex-grow-1">{output.name}</div>

			{#if show_loader}
				<div class="me-2">
					<div class="spinner-border" role="status" style="height:15px;width:15px">
						<span class="visually-hidden">Loading...</span>
					</div>
				</div>
			{/if}

			<div class="me-2">
				<span style="font-size:x-small ">{output['model_name']}</span>
			</div>

			{#if details.files > 0}
				<div class="me-2">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						fill="currentColor"
						class="bi bi-file-earmark"
						viewBox="0 0 16 16"
					>
						<path
							d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5z"
						/>
					</svg>

					{details.files} files
				</div>
			{/if}

			{#if details.time > 0}
				<div class="">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						fill="currentColor"
						class="bi bi-stopwatch"
						viewBox="0 0 16 16"
					>
						<path d="M8.5 5.6a.5.5 0 1 0-1 0v2.9h-3a.5.5 0 0 0 0 1H8a.5.5 0 0 0 .5-.5z" />
						<path
							d="M6.5 1A.5.5 0 0 1 7 .5h2a.5.5 0 0 1 0 1v.57c1.36.196 2.594.78 3.584 1.64l.012-.013.354-.354-.354-.353a.5.5 0 0 1 .707-.708l1.414 1.415a.5.5 0 1 1-.707.707l-.353-.354-.354.354-.013.012A7 7 0 1 1 7 2.071V1.5a.5.5 0 0 1-.5-.5M8 3a6 6 0 1 0 .001 12A6 6 0 0 0 8 3"
						/>
					</svg>
					{details.time} sec
				</div>
			{/if}
		</div>
		<div class="card-body">
			<div class="card-text">
				<div class="d-flex justify-content-end align-items-center mb-3">
					<label for="export-options" class="me-2 mb-0">Export Results</label>

					<select id="export-options" class="form-select form-select-sm w-auto me-2" bind:value={selected_type}>
						{#if output['model_meta']['type'] == 'object_detection'}
							<option value="bbox_images">Labelled Images (ZIP)</option>
							<!-- <option value="labels_json">Object Labels (JSON)</option> -->
							<option value="crops">Cropped Objects (ZIP)</option>
						{/if}
						{#if output['model_meta']['type'] == 'segment_image'}
							<option value="mask_files">Mask Files (ZIP)</option>
							<option value="overlay_files">Masks Overlaid on Originals (ZIP)</option>
							<option value="mask_arrays">Raw Mask Arrays (JSON)</option>
						{/if}
						<option value="raw_files"> Original files (Zip) </option>
						<!-- <option value="summary_report">Summary Report (JSON)</option> -->
					</select>

					<button type="button" class="btn btn-primary btn-sm" onclick={download}>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="10"
							height="10"
							fill="currentColor"
							class="bi bi-download"
							viewBox="0 0 16 16"
						>
							<path
								d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"
							/>
							<path
								d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z"
							/>
						</svg>
						Download
					</button>
				</div>
			</div>

			<details>
				<summary>  <h5 class="card-title d-inline">File preview</h5> </summary>


				<!-- Split layout -->
<div class="row g-0 border rounded overflow-hidden" style="min-height: 70vh;">
  <!-- Left: files -->
  <div class="col-12 col-md-4 border-end">
		<div class="list-group list-group-flush">
			{#each preview_data.item_name_list as k}
				
				<button
					type="button"
					class="list-group-item list-group-item-action d-flex align-items-center justify-content-between {key_selected === k.name ? 'active' : ''}"
					title={k.name}
					onclick={() => select_item(k.name)}
				>
					<div class="d-flex align-items-center gap-2 text-truncate">
						
						<span class="text-truncate" style="max-width: 200px;"> {iconForType(k.type)} {k.name}</span>
					</div>
					
				</button>
			{/each}
		</div>
  </div>

  <!-- Right: preview -->
  <div class="col-12 col-md-8">
    <div class="p-3">
      {#if !key_selected}
        <div class="text-muted">Select an image on the left.</div>
      {:else}
				{#if loaded_selected}

				 <!-- Original -->
				 <h5 class="mb-3"><i class="bi bi-image me-2"></i>Original</h5>
				
				 <PreviewRenderer type={preview_item.type} data={preview_item.raw_file} />

					{#if preview_data.output_type=="object_detection" }
						
					    <!-- Boxes -->
							<h5 class="mb-3"><i class="bi bi-bounding-box-circles me-2"></i>Objects overlay</h5>
							{#if preview_item?.bbox_image}
							
									
								<PreviewRenderer type={preview_item.type} data={preview_item.bbox_image} />


							{:else}
								<div class="text-muted mb-3">No overlay image.</div>
							{/if}
			
							<!-- Objects list -->
							<h5 class="mb-3"><i class="bi bi-list-ul me-2"></i>Objects</h5>
							{#if preview_item?.objects?.length}
								<ul class="list-group mb-3">
									{#each preview_item.objects as obj, i}
										<li class="list-group-item d-flex justify-content-between align-items-center">
											<div>
												<span class="fw-semibold">{obj.class || 'object'}</span>
												{#if obj.score != null}
													<span class="text-muted ms-2">({(obj.score * 100).toFixed(1)}%)</span>
												{/if}
												{#if obj.bbox}
													<small class="text-muted ms-2">
														[x:{obj.bbox[0] | 0}, y:{obj.bbox[1] | 0}, w:{obj.bbox[2] | 0}, h:{obj.bbox[3] | 0}]
													</small>
												{/if}
											</div>
											<span class="badge bg-light text-dark">#{i + 1}</span>
										</li>
									{/each}
								</ul>
							{:else}
								<div class="text-muted mb-3">No objects detected.</div>
							{/if}
			
							<!-- Crops -->
							<details class="mb-2">
								<summary class="h6 mb-2"><i class="bi bi-scissors me-2"></i>Cropped images {#if preview_item?.crops?.length}<span class="badge bg-secondary ms-2">{preview_item.crops.length}</span>{/if}</summary>
								{#if preview_item?.crops?.length}
									<div class="row g-2">
										{#each preview_item.crops as c, idx}
											<div class="col-6 col-lg-4">
												<PreviewRenderer type={preview_item.type} data={c} />
												<div class="small text-truncate mt-1">{c.name}</div>
											</div>
										{/each}
									</div>
								{:else}
									<div class="text-muted">No crops available.</div>
								{/if}
							</details>
					{:else if preview_data.output_type=="segment_image"}

					<h5 class="mb-3"><i class="bi bi-bounding-box-circles me-2"></i>Segmentation mask</h5>
					{#if preview_item?.mask}
						<PreviewRenderer type={preview_item.type} data={preview_item.mask} />
					{:else}
						<div class="text-muted mb-3">No segmentation masks.</div>
					{/if}


					<h5 class="mb-3"><i class="bi bi-bounding-box-circles me-2"></i>Image overlay mask</h5>
					{#if preview_item?.overlay}
						<PreviewRenderer type={preview_item.type} data={preview_item.overlay} />
					{:else}
						<div class="text-muted mb-3">No overlay masks.</div>
					{/if}

					{/if}



					  
		 




						




				{:else}
				<div class="text-muted"> Loadings ... </div>
				{/if}
<!--       
				items.push({
          key,
          raw_file: rawFile,
          bbox_image: bboxImage,
          crops: cropsForImage,
          objects: objectsForImage,
        });
      }

      return {
        item_name_list,
        items,
        output_type:"object_detection"
      }; -->
     
     

  
      {/if}
    </div>
  </div>
</div>



			</details>
		</div>
	</div>
{/if}
