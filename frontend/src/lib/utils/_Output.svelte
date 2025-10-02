<script>
	import { onMount } from 'svelte';
	// import Preview from './_Preview.svelte';
	let { output } = $props();
	let details = $state({ files: 0, time: 0 });
	let loaded = $state(false);
	import { translations, userSettings } from '$lib/utils/store.js';
	import JSZip from 'jszip';

	import PreviewRenderer from './_PreviewRenderer.svelte';
	import Loading from './_Loading.svelte';
	let preview_data = $state({});
	let show_loader = $state(false);
	let key_selected = $state('');
	let loaded_selected = $state(false);
	let preview_item = $state();
	let selected_type = $state('raw_file');
	onMount(async () => {
		if (output) {
			console.log(output);
			details.time = Math.round(
				Object.values(output['run_times']).reduce((a, b) => a + b, 0) / 1000
			);
			details.files = output['input_data_obj']['filelist'].length;
			preview_data = await output.generate_outputs();
			console.log(preview_data);
			loaded = true;
			if(preview_data.item_name_list.length>0){
				select_item(preview_data.item_name_list[0]['name']);
			}
		}
	});

	const select_item = (key) => {
		console.log(key);
		loaded_selected = false;
		preview_item = preview_data.items.find((it) => {
			return it.key == key;
		});
		key_selected = key;
		console.log(preview_item);
		setTimeout(()=>{},100)
		loaded_selected = true;
	};

	// track created Object URLs for cleanup
	const urls = new Set();
	const makeURL = (fileOrBlob) => {
		console.log(fileOrBlob);
		if (!fileOrBlob) return '';
		const u = URL.createObjectURL(fileOrBlob);
		urls.add(u);
		return u;
	};
	const cleanupURLs = () => {
		urls.forEach((u) => URL.revokeObjectURL(u));
		urls.clear();
	};

const iconForType = (t) => {
  if (!t) return `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-paperclip flex-shrink-0" viewBox="0 0 16 16">
      <path d="M4.5 3a2.5 2.5 0 0 1 5 0v9a1.5 1.5 0 0 1-3 0V5a.5.5 0 0 1 1 0v7a.5.5 0 0 0 1 0V3a1.5 1.5 0 1 0-3 0v9a2.5 2.5 0 0 0 5 0V5a.5.5 0 0 1 1 0v7a3.5 3.5 0 1 1-7 0z"/>
    </svg>`;
  
  if (t.startsWith('image')) return `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-file-earmark-image flex-shrink-0" viewBox="0 0 16 16">
      <path d="M6.502 7a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3"/>
      <path d="M14 14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zM4 1a1 1 0 0 0-1 1v10l2.224-2.224a.5.5 0 0 1 .61-.075L8 11l2.157-3.02a.5.5 0 0 1 .76-.063L13 10V4.5h-2A1.5 1.5 0 0 1 9.5 3V1z"/>
    </svg>`;
  
  if (t.startsWith('video')) return `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-camera-video flex-shrink-0" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M0 5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 1.983 1.738l3.11-1.382A1 1 0 0 1 16 4.269v7.462a1 1 0 0 1-1.406.913l-3.111-1.382A2 2 0 0 1 9.5 13H2a2 2 0 0 1-2-2zm11.5 5.175 3.5 1.556V4.269l-3.5 1.556zM2 4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h7.5a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1z"/>
    </svg>`;
  
  if (t.startsWith('text')) return `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-file-earmark-text flex-shrink-0" viewBox="0 0 16 16">
      <path d="M5.5 7a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1zM5 9.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5m0 2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5"/>
      <path d="M9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.5zm0 1v2A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"/>
    </svg>`;
  
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-paperclip flex-shrink-0" viewBox="0 0 16 16">
      <path d="M4.5 3a2.5 2.5 0 0 1 5 0v9a1.5 1.5 0 0 1-3 0V5a.5.5 0 0 1 1 0v7a.5.5 0 0 0 1 0V3a1.5 1.5 0 1 0-3 0v9a2.5 2.5 0 0 0 5 0V5a.5.5 0 0 1 1 0v7a3.5 3.5 0 1 1-7 0z"/>
    </svg>`;
};

	let valid_downloads = {
		segment_image: ['raw_file', 'mask', 'overlay'],
		object_detection: ['raw_file', 'bbox_image', 'crops', 'objects']
	};

	async function download() {
		console.log(selected_type);
		const zip = new JSZip();
		let files = preview_data.items; // downloads[selected_type]
		// Add files to the zip
		for (let file of files) {
			//console.log(file);
			let f = file[selected_type];
			console.log(f)
			if (Array.isArray(f)) {
				for (let itm of f) {
					await zip.file(`${itm.name}`, itm);
				}
			} else {
				await zip.file(f.name, f);
			}
		}
		// Generate the zip
		const content = await zip.generateAsync({ type: 'blob' });

		// Create a download link
		const a = document.createElement('a');
		a.href = URL.createObjectURL(content);
		a.download = `${output.model_name}_${selected_type}.zip`
		a.click();
		URL.revokeObjectURL(a.href); // cleanup
	}
</script>

<!-- <Preview  input={output} /> -->

<div class="card">
	{#if loaded}
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
			
				<details>
					<summary><h6 class="card-title d-inline">Export results</h6></summary>



					<ul class="list-group mt-2" >
						{#if output['model_meta']['type'] == 'segment_image'}
							<li class="list-group-item">
								<div class="d-flex flex-column">
									<div>
										<input
											class="form-check-input me-1"
											type="radio"
											name="listGroupRadio"
											id="o1"
											value="mask"
											bind:group={selected_type}
										/>
										<label class="form-check-label" for="o1">Mask Files</label>
									</div>
									<small class="text-muted ms-4">Raw segmentation mask files produced by the model. Each mask corresponds to an input image or video and encodes segmented regions as pixel-level binary or labeled masks.</small>
								</div>
							</li>

							<li class="list-group-item">
								<div class="d-flex flex-column">
									<div>
										<input
											class="form-check-input me-1"
											type="radio"
											name="listGroupRadio"
											id="o2"
											value="overlay"
											bind:group={selected_type}
										/>
										<label class="form-check-label" for="o2">Masks Overlaid on Originals</label>
									</div>
									<small class="text-muted ms-4">Original input images or videos with segmentation masks visually overlaid in red.</small>
								</div>
							</li>
						{/if}
						{#if output['model_meta']['type'] == 'object_detection'}
						<li class="list-group-item">
							<div class="d-flex flex-column">
								<div>
									<input
										class="form-check-input me-1"
										type="radio"
										name="listGroupRadio"
										id="o3"
										value="bbox_image"
										bind:group={selected_type}
									/>
									<label class="form-check-label" for="o3">Labelled Images</label>
								</div>
								<small class="text-muted ms-4"> Original images with bounding boxes drawn around detected objects. Each box highlights an object's spatial location, with class labels and confidence scores displayed. </small>
							</div>
						</li>
						<li class="list-group-item">
							<div class="d-flex flex-column">
								<div>
									<input
										class="form-check-input me-1"
										type="radio"
										name="listGroupRadio"
										id="o4"
										value="crops"
										bind:group={selected_type}
									/>
									<label class="form-check-label" for="o4">Cropped Objects</label>
								</div>
								<small class="text-muted ms-4"> Individual image files cropped from bounding boxes around each detected object. </small>
							</div>
						</li>					
					{/if}
						<li class="list-group-item">
							<div class="d-flex flex-column">
								<div>
									<input
										class="form-check-input me-1"
										type="radio"
										name="listGroupRadio"
										id="o5"
										value="raw_file"
										bind:group={selected_type}
									/>
									<label class="form-check-label" for="o5">Original files</label>
								</div>
								<small class="text-muted ms-4">The original files you uploaded. </small>
							</div>
						</li>
					</ul>

					




					

					<div class="d-flex justify-content-end align-items-center mb-3">
						<!-- <label for="export-options" class="me-2 mb-0"> {$translations.export_btn} </label> -->
	
						<!-- <select
							id="export-options"
							class="form-select form-select-sm w-auto me-2"
							bind:value={selected_type}
						>
							{#if output['model_meta']['type'] == 'object_detection'}
								<option value="bbox_image">Labelled Images (ZIP)</option>
								<option value="crops">Cropped Objects (ZIP)</option>
							{/if}
							{#if output['model_meta']['type'] == 'segment_image'}
								<option value="mask">Mask Files (ZIP)</option>
								<option value="overlay">Masks Overlaid on Originals (ZIP)</option>
							{/if}
							<option value="raw_file"> Original files (Zip) </option>
						</select> -->
	
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
							Download (ZIP)
						</button>
					</div>
				</details>
				<details class="mt-2">
					<summary> <h6 class="card-title d-inline">Preview results</h6> </summary>
	
					<!-- Split layout -->
					<div class="row g-0 border rounded overflow-hidden mt-1" style="min-height: 70vh;">
						<!-- Left: files -->
						<div class="col-12 col-md-4 border-end">
							<div class="list-group list-group-flush">
								{#each preview_data.item_name_list as k}
									<button
										type="button"
										class="list-group-item list-group-item-action d-flex align-items-center justify-content-between {key_selected ===
										k.name
											? 'active'
											: ''}"
										title={k.name}
										onclick={() => select_item(k.name)}
									>
										<div class="d-flex align-items-center gap-2 text-truncate">
											<span class="text-truncate" style="max-width: 200px;">
												{@html iconForType(k.type)}
												{k.name}</span
											>
										</div>
									</button>
								{/each}
							</div>
						</div>
	
						<!-- Right: preview -->
						<div class="col-12 col-md-8">
							<div class="p-3">
								{#if !key_selected}
									<div class="text-muted"> {$translations.output_label1} </div>
								{:else}
									{#if loaded_selected}
										<!-- Original -->
										<h5 class="mb-3"><i class="bi bi-image me-2"></i>Original</h5>
	
										<PreviewRenderer type={preview_item.type} data={preview_item.raw_file} />
	
										{#if preview_data.output_type == 'object_detection'}
											<!-- Boxes -->
											<h5 class="mb-3">
												<i class="bi bi-bounding-box-circles me-2"></i> {$translations.output_label2} 
											</h5>
											{#if preview_item?.bbox_image}
												<PreviewRenderer type={preview_item.type} data={preview_item.bbox_image} />
											{:else}
												<div class="text-muted mb-3">  {$translations.output_label3}  </div>
											{/if}
	
											<!-- Objects list -->
											<h5 class="mb-3"><i class="bi bi-list-ul me-2"></i>  {$translations.output_label4}  </h5>
											{#if preview_item?.objects?.length}
												<ul class="list-group mb-3">
													{#each preview_item.objects as obj, i}
														<li
															class="list-group-item d-flex justify-content-between align-items-center"
														>
															<div>
																<span class="fw-semibold">{obj.class || 'object'}</span>
																{#if obj.score != null}
																	<span class="text-muted ms-2"
																		>({(obj.score * 100).toFixed(1)}%)</span
																	>
																{/if}
																{#if obj.bbox}
																	<small class="text-muted ms-2">
																		[x:{obj.bbox[0] | 0}, y:{obj.bbox[1] | 0}, w:{obj.bbox[2] | 0}, h:{obj
																			.bbox[3] | 0}]
																	</small>
																{/if}
															</div>
															<span class="badge bg-light text-dark">#{i + 1}</span>
														</li>
													{/each}
												</ul>
											{:else}
												<div class="text-muted mb-3"> {$translations.output_label41}  </div>
											{/if}
	
											<!-- Crops -->
											<details class="mb-2">
												<summary class="h6 mb-2"
													><i class="bi bi-scissors me-2"></i>  {$translations.output_label5}  {#if preview_item?.crops?.length}<span
															class="badge bg-secondary ms-2">{preview_item.crops.length}</span
														>{/if}</summary
												>
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
													<div class="text-muted">  {$translations.output_label6} </div>
												{/if}
											</details>
										{:else if preview_data.output_type == 'segment_image'}
											<h5 class="mb-3">
												<i class="bi bi-bounding-box-circles me-2"></i>   {$translations.output_label7}  
											</h5>
											{#if preview_item?.mask}
												<PreviewRenderer type={preview_item.type} data={preview_item.mask} />
											{:else}
												<div class="text-muted mb-3">   {$translations.output_label8} </div>
											{/if}
	
											<h5 class="mb-3">
												<i class="bi bi-bounding-box-circles me-2"></i>  {$translations.output_label9} 
											</h5>
											{#if preview_item?.overlay}
												<PreviewRenderer type={preview_item.type} data={preview_item.overlay} />
											{:else}
												<div class="text-muted mb-3">   {$translations.output_label9} </div>
											{/if}
										{/if}
									{:else}
										<div class="text-muted">Loadings ...</div>
									{/if}
								{/if}
							</div>
						</div>
					</div>
				</details>
			</div>		
		</div>
	{:else}
		<Loading message="Generating preview. Please wait." />
	{/if}
</div>
