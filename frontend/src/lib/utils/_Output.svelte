<script>
	import { onMount } from 'svelte';
	import { translations, userSettings } from '$lib/utils/store.js';
	import JSZip from 'jszip';
	import PreviewRenderer from './_PreviewRenderer.svelte';
	import Loading from './_Loading.svelte';
	import { InferenceOutput } from './inference.output.js';

	let { outputData } = $props();

	let inferenceOutput = $state(null);
	let loaded = $state(false);
	let keySelected = $state('');
	let selectedFile = $state(null);
	let selectedType = $state('raw_file');

	onMount(async () => {
		if (outputData) {
			console.log('111');
			console.log(outputData);
			inferenceOutput = new InferenceOutput(outputData);
			loaded = true;

			// Select first file
			if (inferenceOutput.fileList.length > 0) {
				selectItem(inferenceOutput.fileList[0].key);
			}
		}
	});
	const selectItem = (key) => {
		keySelected = key;
		selectedFile = inferenceOutput.getFile(key);
		console.log('Selected:', selectedFile);
	};

	const iconForType = (t) => {
		if (!t)
			return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-paperclip flex-shrink-0" viewBox="0 0 16 16"><path d="M4.5 3a2.5 2.5 0 0 1 5 0v9a1.5 1.5 0 0 1-3 0V5a.5.5 0 0 1 1 0v7a.5.5 0 0 0 1 0V3a1.5 1.5 0 1 0-3 0v9a2.5 2.5 0 0 0 5 0V5a.5.5 0 0 1 1 0v7a3.5 3.5 0 1 1-7 0z"/></svg>`;
		if (t.startsWith('image'))
			return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-file-earmark-image flex-shrink-0" viewBox="0 0 16 16"><path d="M6.502 7a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3"/><path d="M14 14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zM4 1a1 1 0 0 0-1 1v10l2.224-2.224a.5.5 0 0 1 .61-.075L8 11l2.157-3.02a.5.5 0 0 1 .76-.063L13 10V4.5h-2A1.5 1.5 0 0 1 9.5 3V1z"/></svg>`;
		if (t.startsWith('video'))
			return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-camera-video flex-shrink-0" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M0 5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 1.983 1.738l3.11-1.382A1 1 0 0 1 16 4.269v7.462a1 1 0 0 1-1.406.913l-3.111-1.382A2 2 0 0 1 9.5 13H2a2 2 0 0 1-2-2zm11.5 5.175 3.5 1.556V4.269l-3.5 1.556zM2 4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h7.5a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1z"/></svg>`;
		return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-paperclip flex-shrink-0" viewBox="0 0 16 16"><path d="M4.5 3a2.5 2.5 0 0 1 5 0v9a1.5 1.5 0 0 1-3 0V5a.5.5 0 0 1 1 0v7a.5.5 0 0 0 1 0V3a1.5 1.5 0 1 0-3 0v9a2.5 2.5 0 0 0 5 0V5a.5.5 0 0 1 1 0v7a3.5 3.5 0 1 1-7 0z"/></svg>`;
	};

	async function download() {
		// Handle report download separately
		if (selectedType === 'report') {
			const report =  inferenceOutput.toReportWithOutputs();
			const blob = new Blob([JSON.stringify(report, null, 2)], {
				type: 'application/json'
			});
			const a = document.createElement('a');
			a.href = URL.createObjectURL(blob);
			a.download = `${inferenceOutput.model.name}_report.json`;
			a.click();
			URL.revokeObjectURL(a.href);
			return;
		}

		const zip = new JSZip();

		for (let file of inferenceOutput.files) {
			if (selectedType === 'raw_file') {
				zip.file(file.key, file.input);
			} else {
				// Get outputs of selected type
				const outputs = file.outputs.filter((o) => o.type === selectedType);
				for (let output of outputs) {
					zip.file(output.name, output.file);
				}
			}
		}

		const content = await zip.generateAsync({ type: 'blob' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(content);
		a.download = `${inferenceOutput.model.name}_${selectedType}.zip`;
		a.click();
		URL.revokeObjectURL(a.href);
	}

	// Helper to format time
	const formatTime = (ms) => {
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(1)}s`;
	};
</script>

<div class="card">
	{#if loaded && inferenceOutput}
		<div class="card-header d-flex">
			<div class="flex-grow-1">{inferenceOutput.task.name}</div>

			<div class="me-2">
				<span style="font-size:x-small">{inferenceOutput.model.name}</span>
			</div>

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
				{inferenceOutput.execution.files_processed} files
			</div>

			<!-- <div class="">
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
				{formatTime(inferenceOutput.task.duration_ms)}
			</div> -->
		</div>

		<div class="card-body">
			<div class="card-text">
				<details>
					<summary><h6 class="card-title d-inline">Export results</h6></summary>

					<ul class="list-group mt-2">
						{#if inferenceOutput.model.type === 'segment_image'}
							<li class="list-group-item">
								<div class="d-flex flex-column">
									<div>
										<input
											class="form-check-input me-1"
											type="radio"
											name="listGroupRadio"
											id="o1"
											value="mask"
											bind:group={selectedType}
										/>
										<label class="form-check-label" for="o1">Mask Files</label>
									</div>
									<small class="text-muted ms-4"
										>Raw segmentation mask files produced by the model.</small
									>
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
											bind:group={selectedType}
										/>
										<label class="form-check-label" for="o2">Masks Overlaid on Originals</label>
									</div>
									<small class="text-muted ms-4"
										>Original input images with segmentation masks overlaid.</small
									>
								</div>
							</li>
						{/if}

						{#if inferenceOutput.model.type === 'object_detection'}
							<li class="list-group-item">
								<div class="d-flex flex-column">
									<div>
										<input
											class="form-check-input me-1"
											type="radio"
											name="listGroupRadio"
											id="o3"
											value="bbox_image"
											bind:group={selectedType}
										/>
										<label class="form-check-label" for="o3">Labelled Images</label>
									</div>
									<small class="text-muted ms-4"
										>Original images with bounding boxes drawn around detected objects.</small
									>
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
											value="crop"
											bind:group={selectedType}
										/>
										<label class="form-check-label" for="o4">Cropped Objects</label>
									</div>
									<small class="text-muted ms-4"
										>Individual image files cropped from bounding boxes.</small
									>
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
										bind:group={selectedType}
									/>
									<label class="form-check-label" for="o5">Original files</label>
								</div>
								<small class="text-muted ms-4">The original files you uploaded.</small>
							</div>
						</li>
						<li class="list-group-item">
							<div class="d-flex flex-column">
								<div>
									<input
										class="form-check-input me-1"
										type="radio"
										name="listGroupRadio"
										id="o6"
										value="report"
										bind:group={selectedType}
									/>
									<label class="form-check-label" for="o6">Inference Report (JSON)</label>
								</div>
								<small class="text-muted ms-4"
									>Complete inference report with all results, timings, and generated outputs
									(excludes original input files).</small
								>
							</div>
						</li>
					</ul>

					<div class="d-flex justify-content-end align-items-center mt-3">
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
				</details>

				<details class="mt-2">
					<summary><h6 class="card-title d-inline">Preview results</h6></summary>

					<div class="row g-0 border rounded overflow-hidden mt-1" style="min-height: 70vh;">
						<!-- Left: files -->
						<div class="col-12 col-md-4 border-end">
							<div class="list-group list-group-flush">
								{#each inferenceOutput.fileList as item}
									<button
										type="button"
										class="list-group-item list-group-item-action d-flex align-items-center justify-content-between {keySelected ===
										item.key
											? 'active'
											: ''}"
										title={item.key}
										onclick={() => selectItem(item.key)}
									>
										<div class="d-flex align-items-center gap-2 text-truncate">
											<span class="text-truncate" style="max-width: 200px;">
												{@html iconForType(item.type)}
												{item.key}
											</span>
										</div>
									</button>
								{/each}
							</div>
						</div>

						<!-- Right: preview -->
						<div class="col-12 col-md-8">
							<div class="p-3">
								{#if !keySelected}
									<div class="text-muted">{$translations.output_label1}</div>
								{:else if selectedFile}
									<!-- Original -->
									<h5 class="mb-3"><i class="bi bi-image me-2"></i>Original</h5>
									<PreviewRenderer type={selectedFile.type} data={selectedFile.input} />

									{#if inferenceOutput.model.type === 'object_detection'}
										<!-- Bounding boxes -->
										<h5 class="mb-3">
											<i class="bi bi-bounding-box-circles me-2"></i>{$translations.output_label2}
										</h5>
										{#if inferenceOutput.getBboxImage(keySelected)}
											<PreviewRenderer
												type={selectedFile.type}
												data={inferenceOutput.getBboxImage(keySelected)}
											/>
										{:else}
											<div class="text-muted mb-3">{$translations.output_label3}</div>
										{/if}

										<!-- Objects list -->
										<h5 class="mb-3">
											<i class="bi bi-list-ul me-2"></i>{$translations.output_label4}
										</h5>
										{#if inferenceOutput.getDetections(keySelected).length}
											<ul class="list-group mb-3">
												{#each inferenceOutput.getDetections(keySelected) as obj, i}
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
																	[x:{Math.floor(obj.bbox[0])}, y:{Math.floor(obj.bbox[1])}, w:{Math.floor(
																		obj.bbox[2]
																	)}, h:{Math.floor(obj.bbox[3])}]
																</small>
															{/if}
														</div>
														<span class="badge bg-light text-dark">#{i + 1}</span>
													</li>
												{/each}
											</ul>
										{:else}
											<div class="text-muted mb-3">{$translations.output_label41}</div>
										{/if}

										<!-- Crops -->
										<details class="mb-2">
											<summary class="h6 mb-2">
												<i class="bi bi-scissors me-2"></i>{$translations.output_label5}
												{#if inferenceOutput.getCrops(keySelected).length}
													<span class="badge bg-secondary ms-2"
														>{inferenceOutput.getCrops(keySelected).length}</span
													>
												{/if}
											</summary>
											{#if inferenceOutput.getCrops(keySelected).length}
												<div class="row g-2">
													{#each inferenceOutput.getCrops(keySelected) as crop, idx}
														<div class="col-6 col-lg-4">
															<PreviewRenderer type={selectedFile.type} data={crop} />
															<div class="small text-truncate mt-1">{crop.name}</div>
														</div>
													{/each}
												</div>
											{:else}
												<div class="text-muted">{$translations.output_label6}</div>
											{/if}
										</details>
									{:else if inferenceOutput.model.type === 'segment_image'}
										<!-- Mask -->
										<h5 class="mb-3">
											<i class="bi bi-bounding-box-circles me-2"></i>{$translations.output_label7}
										</h5>
										{#if inferenceOutput.getMask(keySelected)}
											<PreviewRenderer
												type={selectedFile.type}
												data={inferenceOutput.getMask(keySelected)}
											/>
										{:else}
											<div class="text-muted mb-3">{$translations.output_label8}</div>
										{/if}

										<!-- Overlay -->
										<h5 class="mb-3">
											<i class="bi bi-bounding-box-circles me-2"></i>{$translations.output_label9}
										</h5>
										{#if inferenceOutput.getOverlay(keySelected)}
											<PreviewRenderer
												type={selectedFile.type}
												data={inferenceOutput.getOverlay(keySelected)}
											/>
										{:else}
											<div class="text-muted mb-3">{$translations.output_label9}</div>
										{/if}
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
