<!-- This is to show preview for a input object. It takes an input object and shows a button which when clicked shows the input preview in the side bar  -->
<script>
	import { onMount } from 'svelte';
	import { VideoFile, BaseImage } from 'dlonwebjs';

	let { input } = $props();
	let rid = $state('');
	onMount(async () => {
		rid = 'id-' + Math.floor(Math.random() * 1000);
		if (input) {
			setTimeout(() => {
				console.log(rid);
				showMedia(input, rid);
			}, 500);
		} else {
			console.log('Nothing provided');
		}
		console.log('on mount preview');
	});

	function addClassIfMissing(element, className) {
		if (!element.classList.contains(className)) {
			element.classList.add(className);
		}
	}

	const showMedia = async (media, location) => {
		const locationdiv = document.getElementById(location);
		console.log(locationdiv);
		addClassIfMissing(locationdiv, 'imageContainer');
		locationdiv.innerHTML = '';

		if (media instanceof BaseImage) {
			const img = document.createElement('img');
			img.src = media.toObjectURL();
			locationdiv.appendChild(img);
		} else if (media instanceof VideoFile) {
			try {
				// 1. Show the original video
				const videoURL = URL.createObjectURL(media.file);
				const videoEl = document.createElement('video');
				videoEl.src = videoURL;
				videoEl.controls = true;
				videoEl.style.maxWidth = '100%';
				locationdiv.appendChild(videoEl);

				// 2. Add a divider or label for extracted frames
				const labelFrames = document.createElement('div');
				labelFrames.innerText = 'Extracted Frames:';
				labelFrames.style.marginTop = '10px';
				locationdiv.appendChild(labelFrames);

				// 3. Show each extracted frame as an image
				for (const frame of media._frames) {
					const img = document.createElement('img');
					img.src = frame.toObjectURL();
					img.style.maxWidth = '100%';
					img.style.margin = '4px 0';
					locationdiv.appendChild(img);
				}

				// 4. Add a divider or label for reconstructed video
				// const labelReconstructed = document.createElement("div");
				// labelReconstructed.innerText = "Reconstructed Video from Frames:";
				// labelReconstructed.style.marginTop = "20px";
				// locationdiv.appendChild(labelReconstructed);

				// // 5. Convert frames to video and show it
				// const reconstructedVideoURL = await media.convertFramesToVideo();
				// const reconstructedVideoEl = document.createElement("video");
				// reconstructedVideoEl.src = reconstructedVideoURL;
				// reconstructedVideoEl.controls = true;
				// reconstructedVideoEl.style.maxWidth = "100%";
				// locationdiv.appendChild(reconstructedVideoEl);
			} catch (err) {
				console.error(err);
				locationdiv.innerText = 'Failed to load file: ' + err.message;
			}
		} else if (media instanceof FileList) {
			// Handle file list if needed
		} else {
			throw new Error('Invalid media type');
		}
	};
</script>

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
			</div>
			<div class="modal-footer">
				<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
			</div>
		</div>
	</div>
</div>
