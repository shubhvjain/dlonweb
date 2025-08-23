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


/**
 * Convert array of images into a video Blob.
 * @param {Array<Blob|File|HTMLImageElement|string>} images - Array of image Blobs, Files, URLs, or HTMLImageElements
 * @param {Object} options
 * @param {number} options.fps - Frames per second
 * @param {number} [options.width] - Optional output width
 * @param {number} [options.height] - Optional output height
 * @param {string} [options.mimeType] - e.g. "video/webm"
 * @returns {Promise<Blob>} - The resulting video blob
 */
 async function imagesToVideo(images, { fps = 10, width, height, mimeType = "video/webm" } = {}) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const loadedImages = await Promise.all(
    images.map(img => loadImageElement(img))
  );

  const w = width || loadedImages[0].naturalWidth;
  const h = height || loadedImages[0].naturalHeight;

  canvas.width = w;
  canvas.height = h;

  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType });

  const chunks = [];
  recorder.ondataavailable = e => chunks.push(e.data);

  recorder.start();

  for (const img of loadedImages) {
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    await new Promise(r => setTimeout(r, 1000 / fps));
  }

  recorder.stop();

  return new Promise(resolve => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      resolve(blob);
    };
  });
}

/**
 * Load image from various formats into an HTMLImageElement
 * @param {Blob|File|string|HTMLImageElement} source
 * @returns {Promise<HTMLImageElement>}
 */
function loadImageElement(source) {
  return new Promise((resolve, reject) => {
    if (source instanceof HTMLImageElement) return resolve(source);

    const img = new Image();
    img.crossOrigin = "anonymous";

    if (typeof source === "string") {
      img.src = source;
    } else {
      img.src = URL.createObjectURL(source);
    }

    img.onload = () => resolve(img);
    img.onerror = reject;
  });
}

let docvid = $state()
async function run_video(){
	let ar = frames.map(itm=>itm.url)
	let b = await imagesToVideo(ar)
	console.log(b)
	const url = URL.createObjectURL(b);
const video = document.createElement("video");
video.src = url;
video.controls = true;
docvid.appendChild(video);
}
	

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
						<button onclick={run_video}>Video</button>
						<div bind:this={docvid}></div>
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
