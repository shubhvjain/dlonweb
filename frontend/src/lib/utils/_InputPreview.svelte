<!-- DataPreview.svelte - Preview button that opens modal with split view -->
<script>
	import { Data } from 'dlonwebjs';
	import { onMount } from 'svelte';

	let { data = [] } = $props();
	
	let selectedIndex = $state(-1);
	let selectedData = $state(null);
	let previewContent = $state(null);
	let loading = $state(false);
	let error = $state('');
	let modalId = $state('');

	// Preview content structure
	let preview = $state({
		type: null, // 'image', 'video', 'text'
		url: null,
		textContent: '',
		frames: [], // for video frames
		metadata: {}
	});

	onMount(() => {
		// Generate unique modal ID
		modalId = 'previewModal-' + Math.floor(Math.random() * 10000);
		
		// Auto-select first item if available
		if (data.length > 0) {
			selectDataItem(0);
		}
	});

	async function selectDataItem(index) {
		if (index === selectedIndex) return;
		
		selectedIndex = index;
		selectedData = data[index];
		loading = true;
		error = '';

		try {
			if (!selectedData.loaded) {
				await selectedData.load();
			}

			await generatePreview(selectedData);
		} catch (e) {
			error = `Error loading preview: ${e.message}`;
		} finally {
			loading = false;
		}
	}

	async function generatePreview(dataItem) {
		const kind = dataItem.kind;
		const blob = await dataItem.toBlob();

		preview = {
			type: null,
			url: null,
			textContent: '',
			frames: [],
			metadata: {
				kind: dataItem.kind,
				structure: dataItem.structure,
				meta: dataItem.meta
			}
		};

		switch (kind) {
			case 'image':
				preview.type = 'image';
				preview.url = URL.createObjectURL(blob);
				break;

			case 'text':
				preview.type = 'text';
				const buffer = await blob.arrayBuffer();
				preview.textContent = new TextDecoder().decode(buffer);
				break;

			case 'video':
				preview.type = 'video';
				preview.url = URL.createObjectURL(blob);
				
				// Get video frames
				const tensorObjects = await dataItem.getTensor();
				preview.frames = tensorObjects.map(({ raw, timestamp }) => ({
					url: URL.createObjectURL(raw),
					timestamp
				}));
				break;

			default:
				preview.type = 'unsupported';
				break;
		}
	}

	function getFileIcon(kind) {
		switch (kind) {
			case 'image': return '🖼️';
			case 'video': return '🎥';
			case 'text': return '📄';
			default: return '📎';
		}
	}

	function getFileName(dataItem, index) {
		// Try to get filename from the original input
		if (dataItem.input && dataItem.input.name) {
			return dataItem.input.name;
		}
		return `Item ${index + 1} (${dataItem.kind})`;
	}

	function formatFileSize(dataItem) {
		if (dataItem.input && dataItem.input.size) {
			const size = dataItem.input.size;
			if (size < 1024) return `${size} B`;
			if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
			return `${(size / (1024 * 1024)).toFixed(1)} MB`;
		}
		return '';
	}

	function getFileCount() {
		const counts = { images: 0, videos: 0, texts: 0, others: 0 };
		data.forEach(item => {
			switch (item.kind) {
				case 'image': counts.images++; break;
				case 'video': counts.videos++; break;
				case 'text': counts.texts++; break;
				default: counts.others++; break;
			}
		});
		return counts;
	}
</script>

<style>
	.preview-container {
		height: 70vh;
	}

	.file-list {
		max-height: 70vh;
		overflow-y: auto;
	}

	.file-item {
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.file-item:hover {
		background-color: var(--bs-secondary-bg) !important;
	}

	.file-icon {
		font-size: 1.5rem;
	}

	.preview-image {
		/* max-width: 100%; */
		max-height: 500px;
	}

	.preview-video {
		/* width: 100%; */
		max-width: 800px;
	}

	.preview-text {
		font-family: 'Courier New', monospace;
		font-size: 0.9rem;
		white-space: pre-wrap;
		max-height: 400px;
		overflow: auto;
	}

	.frames-container {
		display: flex;
		overflow-x: auto;
		gap: 0.75rem;
		padding: 0.75rem;
	}

	.frame-item {
		flex-shrink: 0;
		text-align: center;
	}

	.frame-image {
		max-width: 200px;
		max-height: 300px;
		object-fit: cover;
	}

	.frame-timestamp {
		font-size: 0.75rem;
		margin-top: 0.25rem;
	}
</style>

<!-- Preview Button -->
{#if data && data.length > 0}
	{@const counts = getFileCount()}
	<button 
		type="button" 
		class="btn btn-link" 
		data-bs-toggle="modal" 
		data-bs-target="#{modalId}"
	>
		<i class="bi bi-eye me-2"></i>
		Preview Files ({data.length})
	</button>
{:else}
	<button type="button" class="btn btn-outline-secondary" disabled>
		<i class="bi bi-eye-slash me-2"></i>
		No Files to Preview
	</button>
{/if}

<!-- Large Modal -->
<div class="modal fade" id={modalId} tabindex="-1" aria-labelledby="{modalId}Label" aria-hidden="true">
	<div class="modal-dialog modal-xl">
		<div class="modal-content">
			<div class="modal-header">
				<h1 class="modal-title fs-5" id="{modalId}Label">
					<i class="bi bi-files me-2"></i>
					File Preview ({data.length} files)
				</h1>
				<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
			</div>
			<div class="modal-body p-0">
				<div class="container-fluid p-0" style="overflow-y: scroll;">
					<div class="row g-0 preview-container">
						<!-- File List -->
						<div class="col-4 border-end">
							<div class="file-list">
								{#if data.length === 0}
									<div class="d-flex align-items-center justify-content-center h-100 text-muted fst-italic">
										No files loaded
									</div>
								{:else}
									<div class="list-group list-group-flush">
										{#each data as dataItem, index}
											<button 
												type="button"
												class="list-group-item list-group-item-action d-flex align-items-center gap-3 file-item {selectedIndex === index ? 'active' : ''}"
												onclick={() => selectDataItem(index)}
											>
												<div class="file-icon flex-shrink-0">
													{getFileIcon(dataItem.kind)}
												</div>
												<div class="flex-grow-1 min-w-0">
													<div class="fw-semibold text-truncate" title={getFileName(dataItem, index)}>
														{getFileName(dataItem, index)}
													</div>
													<small class="text-muted">
														{dataItem.kind} • {formatFileSize(dataItem)}
													</small>
												</div>
											</button>
										{/each}
									</div>
								{/if}
							</div>
						</div>

						<!-- Preview Content -->
						<div class="col-8">
							<div class="p-4 h-100 overflow-auto">
								{#if selectedData === null}
									<div class="d-flex align-items-center justify-content-center h-100 text-muted fst-italic">
										Select a file to preview
									</div>
								{:else if loading}
									<div class="d-flex align-items-center justify-content-center" style="height: 200px;">
										<div class="spinner-border text-primary" role="status">
											<span class="visually-hidden">Loading...</span>
										</div>
									</div>
								{:else if error}
									<div class="alert alert-danger">
										<i class="bi bi-exclamation-triangle-fill me-2"></i>
										{error}
									</div>
								{:else}
									<!-- Image Preview -->
									{#if preview.type === 'image'}
										<div>
											<h5 class="mb-3">
												<i class="bi bi-image me-2"></i>
												Image Preview
											</h5>
											<div class="text-center">
												<img src={preview.url} alt="Preview" class="preview-image border rounded shadow-sm" />
											</div>
										</div>

									<!-- Text Preview -->
									{:else if preview.type === 'text'}
										<div>
											<h5 class="mb-3">
												<i class="bi bi-file-text me-2"></i>
												Text Content
											</h5>
											<div class="border rounded bg-light p-3">
												<pre class="preview-text mb-0">{preview.textContent}</pre>
											</div>
										</div>

									<!-- Video Preview -->
									{:else if preview.type === 'video'}
										<div>
											<h5 class="mb-3">
												<i class="bi bi-play-circle me-2"></i>
												Video Preview
											</h5>
											<div class="text-center mb-4">
												<video controls class="preview-video border rounded shadow-sm">
													<source src={preview.url} type="video/mp4">
													<source src={preview.url} type="video/webm">
													Your browser does not support the video tag.
												</video>
											</div>
											
											{#if preview.frames.length > 0}
												<div>
													<h6 class="mb-3">
														<i class="bi bi-collection me-2"></i>
														Video Frames (FPS: {preview.metadata.meta?.fps || 'auto'})
													</h6>
													<div class="border rounded frames-container">
														{#each preview.frames as frame, index}
															<div class="frame-item">
																<img 
																	src={frame.url} 
																	alt="Frame {index}" 
																	class="frame-image border rounded shadow-sm"
																/>
																<div class="frame-timestamp text-muted">
																	{frame.timestamp}ms
																</div>
															</div>
														{/each}
													</div>
												</div>
											{/if}
										</div>

									<!-- Unsupported -->
									{:else}
										<div class="alert alert-warning">
											<h5 class="alert-heading">
												<i class="bi bi-file-earmark-x me-2"></i>
												Unsupported File Type
											</h5>
											<p class="mb-0">Preview not available for {preview.metadata.kind} files.</p>
										</div>
									{/if}

									<!-- Metadata Section -->
									<div class="card mt-4">
										<div class="card-header">
											<h6 class="card-title mb-0">
												<i class="bi bi-info-circle me-2"></i>
												File Information
											</h6>
										</div>
										<div class="card-body">
											<div class="row g-2">
												<div class="col-sm-6">
													<strong>Kind:</strong> <span class="badge bg-secondary">{preview.metadata.kind}</span>
												</div>
												<div class="col-sm-6">
													<strong>Structure:</strong> <span class="badge bg-info">{preview.metadata.structure}</span>
												</div>
												{#if Object.keys(preview.metadata.meta).length > 0}
													<div class="col-12 mt-3">
														<strong>Metadata:</strong>
														<pre class=" p-2 rounded mt-1 small">{JSON.stringify(preview.metadata.meta, null, 2)}</pre>
													</div>
												{/if}
											</div>
										</div>
									</div>
								{/if}
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="modal-footer">
				<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
					<i class="bi bi-x-circle me-2"></i>
					Close
				</button>
			</div>
		</div>
	</div>
</div>