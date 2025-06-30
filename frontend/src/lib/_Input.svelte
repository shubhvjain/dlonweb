<!-- this is to read input or any kind from the user. it returns appropriate input class -->
<script>
  import axios from 'axios';
	import { Data } from 'dlonwebjs';
	import { browserOptions } from '$lib/data.browser';
  import {getAllSettings} from "$lib/settings"
	let file = $state(null);
	let data = $state(null);
	let previewURL = $state(null);
	let error1 = $state(null);
  let settings = $state()

  onMount(()=>{
    settings = getAllSettings()
  })

	async function handleLoad() {
		if (!file) {
			error1 = 'Please select a file.';
			return;
		}
		error1 = null;

		try {
			data = new Data(file, browserOptions);
			await data.load();
			console.log('Data loaded:', data);
		} catch (e) {
			error1 = 'Error loading data: ' + e.message;
		}
	}

	async function handlePreview() {
		if (!data || !data.loaded) {
			error1 = 'Data not loaded yet.';
			return;
		}

		try {
			const blob = await data.toBlob();
			previewURL = URL.createObjectURL(blob);
		} catch (e) {
			error1 = 'Preview failed: ' + e.message;
		}
	}

	async function handleUpload() {
		if (!file) {
      alert('Please select a file.');
      return;
    }
    let metadata = {
      "type":"something"
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify(metadata));

    try {
      let url = settings.backendURL
      const response = await axios.post(url+'/action/inference', formData, {
        headers: {
          'Accept': 'application/json'
        }
      });

      console.log('Response:', response.data);
      alert('File uploaded and processed successfully.');
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload file.');
    }
	}

	// import { load_input } from 'dlonwebjs';

	import Preview from './_Preview.svelte';
	import { sqrt } from '@tensorflow/tfjs';
	import { onMount } from 'svelte';

	let { input = $bindable(), input_valid = $bindable(false) } = $props();
	const allowedTypes = [
		'image/png',
		'image/jpeg',
		'video/mp4',
		'video/webm',
		'image/tiff',
		'image/tif'
	];
	let error = $state('');

	let currentFile = $state();
	let fps = $state(10); // default FPS for videos
	let isVideo = $state(false);

	async function loadFile(file) {
		input = null;
		input_valid = false;
		error = '';

		if (!file) {
			error = 'No file selected.';
			return;
		}

		if (!allowedTypes.includes(file.type)) {
			error = 'Unsupported file type.';
			input_valid = false;
			return;
		}

		try {
			// Pass FPS only if video
			const options = isVideo ? { fps } : {};
			const result = await load_input(file, options);
			if (result) {
				input = result;
				input_valid = true;
				error = '';
			} else {
				error = 'Failed to load input.';
			}
		} catch (err) {
			input = null;
			console.error(err);
			error = 'An error occurred while loading the file.';
		}
	}

	async function handleFileChange(event) {
		let file = event.target.files[0];
		currentFile = file;
		isVideo = file && file.type.startsWith('video/');
		fps = 10; // reset fps when new file selected
	}

	$effect(() => {});

	const load_input_file = async () => {
		await loadFile(currentFile);
	};
</script>

<div class="card">
	<input
		type="file"
		onchange={(e) => {
			file = e.target.files[0];
		}}
	/>
	<div>
		<button onclick={handleLoad}>Load</button>
    <button onclick={handleUpload} disabled={!data}>Upload</button>

		<button onclick={handlePreview} disabled={!data}>Preview</button>
	</div>

	{#if error1}
		<p style="color: red">{error1}</p>
	{/if}

	{#if previewURL}
		{#if data?.kind === 'image'}
			<img src={previewURL} class="preview" />
		{:else if data?.kind === 'video'}
			<video src={previewURL} class="preview" controls />
		{:else}
			<p>Preview not available for this data type.</p>
		{/if}
	{/if}
</div>

<div class="d-flex border-bottom1 mb-2">
	<div class="p-1 flex-grow-1">
		<h4 class={input_valid ? 'text-success' : 'text-danger'}>Input</h4>
	</div>
	<div class="p-2">
		{#if input}
			{#if input_valid}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
					fill="currentColor"
					class="bi bi-check2-circle text-success"
					viewBox="0 0 16 16"
				>
					<path
						d="M2.5 8a5.5 5.5 0 0 1 8.25-4.764.5.5 0 0 0 .5-.866A6.5 6.5 0 1 0 14.5 8a.5.5 0 0 0-1 0 5.5 5.5 0 1 1-11 0"
					/>
					<path
						d="M15.354 3.354a.5.5 0 0 0-.708-.708L8 9.293 5.354 6.646a.5.5 0 1 0-.708.708l3 3a.5.5 0 0 0 .708 0z"
					/>
				</svg>
			{:else}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
					fill="currentColor"
					class="bi bi-exclamation-circle text-danger"
					viewBox="0 0 16 16"
				>
					<path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16" />
					<path
						d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0M7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0z"
					/>
				</svg>
			{/if}
		{:else if error}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="20"
				height="20"
				fill="currentColor"
				class="bi bi-exclamation-circle text-danger"
				viewBox="0 0 16 16"
			>
				<path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16" />
				<path
					d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0M7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0z"
				/>
			</svg>
		{/if}
	</div>
</div>
<div>
	<input id="file-upload" type="file" accept="image/*,video/*" onchange={handleFileChange} />

	{#if isVideo}
		<div class="mt-2">
			<label for="fps-input">Frames Per Second:</label>
			<input id="fps-input" type="number" min="1" max="60" bind:value={fps} class="form-control" />
		</div>
	{/if}

	<div class="d-flex border-bottom1 mb-2">
		<div class="p-2 flex-grow-1">
			{#if error}
				<div class="alert alert-danger m-1">
					{error}
				</div>
			{/if}
		</div>
		<div class="p-2">
			<button class="btn btn-success" onclick={load_input_file}>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					fill="currentColor"
					class="bi bi-image-fill"
					viewBox="0 0 16 16"
				>
					<path
						d="M.002 3a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-12a2 2 0 0 1-2-2zm1 9v1a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062zm5-6.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0"
					/>
				</svg>
				Load input
			</button>
		</div>
	</div>
</div>
{#if input && input_valid}
	<Preview {input} />
{/if}
