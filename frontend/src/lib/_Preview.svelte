<!-- This is to show preview for a input object. It takes an input object and shows a button which when clicked shows the input preview in the side bar  -->
<script>
	import { Data } from 'dlonwebjs';
	import { onMount } from 'svelte';
	// import { VideoFile, BaseImage, ImageStackFile } from 'dlonwebjs';
	// import * as GeoTIFF from 'geotiff';

	let { input } = $props();
	let previewUrl = $state(null);
	let textContent = $state('');
	let showPreview = $state(false);
	let rid = $state('');
	let frames = $state([]);               // Array of {url, timestamp}
	onMount(async () => {
		rid = 'id-' + Math.floor(Math.random() * 1000);
		showPreview  = false
		if (input && input instanceof Data) {
			if (!input.loaded) {
				await input.load();
			}
			const blob = await input.toBlob();
			const kind = input.kind;

			if (kind === 'image') {
				previewUrl = URL.createObjectURL(blob);
			} else if (kind === 'text') {
				const buffer = await blob.arrayBuffer();
				textContent = new TextDecoder().decode(buffer);
			}else if (kind=="video"){
				const blob = await input.toBlob();
				previewUrl = URL.createObjectURL(blob); // for <video> tag

				const tensorObjects = await input.getTensor(); // array of {tensor, timestamp, raw}
					console.log(tensorObjects)
				frames = tensorObjects.map(({ raw, timestamp }) => ({
					url: URL.createObjectURL(raw),
					timestamp
				}));
				console.log(frames)
			}
			showPreview = true;
		}
	});
</script>

<style>
	.preview-container {
		display: flex;
  overflow-x: auto;
  gap: 8px;
  max-width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  /* optional: smooth scrolling */
  scroll-behavior: smooth;
	height: 200px;
	}

	.video-preview {
		margin-bottom: 1rem;
	}

	.frame-preview {
		height: 150px;
  flex-shrink: 0;
  border: 1px solid #ddd;
	}

	.frame-preview img {
		max-width: 100%;
		width: 200px;
		border: 1px solid #ddd;
	}

	video {
		max-width: 100%;
		border: 1px solid #bbb;
	}
</style>


{#if input}
	<button type="button" class="btn btn-link" data-bs-toggle="modal" data-bs-target="#Modal{rid}">
		Preview
	</button>
{/if}

<!-- Button trigger modal -->

<!-- Modal -->
<div
	class="modal modal-lg fade"
	id="Modal{rid}"
	tabindex="-1"
	aria-labelledby="exampleModalLabel"
	aria-hidden="true"
>
	<div class="modal-dialog">
		<div class="modal-content">
			<div class="modal-header">
				<h1 class="modal-title fs-5" id="exampleModalLabel">Preview</h1>
				<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
			</div>
			<div class="modal-body">
				<div id={rid}></div>
				{#if showPreview}
					{#if input.kind === 'image'}
						<div class="image-preview">
							<img src={previewUrl} alt="Image Preview" />
						</div>
					{:else if input.kind === 'text'}
						<pre class="text-preview">{textContent}</pre>

					{:else if input.kind === 'video'}
					<div>
						<div class="video-preview">
							<video controls src={previewUrl}></video>
						</div>

						<div class="preview-container">
							{#each frames as { url, timestamp }, i}
								<div class="frame-preview">
									<img src={url} alt={`Frame ${i}`} />
									<div><strong>{timestamp}ms</strong></div>
								</div>
							{/each}
						</div>
					</div>
					{:else}
						<p>Preview not supported for kind: {input.kind}</p>
					{/if}
				{/if}
			</div>
			<div class="modal-footer">
				<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
			</div>
		</div>
	</div>
</div>
