<!-- this is to read input or any kind from the user. it returns appropriate input class -->
<script>
	let { 
		data_emit = ()=>{}
	} = $props();
	
	import { filesStore } from '$lib/utils/filesStorage.js'; 
	import Dropzone from 'svelte-file-dropzone';
	import JSZip from 'jszip';
	import axios from 'axios';
	// import Preview from './_Preview.svelte';
	import { onMount } from 'svelte';
	import { Data } from 'dlonwebjs';
	import { input } from '@tensorflow/tfjs';

	import { translations, userSettings } from '$lib/utils/store.js';

	//let file = $state(null);
	
	let fps = $state(10); // default FPS for videos

	let files = $state([]);
	let hasVideo = $state(false);
	let error = $state('');
	let progress = $state(0);
	let data = $state([])
	let data_valid = $state(false) 
	let data_error = $state("")


	const allowedTypes = [
		'image/png',
		'image/jpeg',
		'video/mp4',
		'video/webm',
		'image/tiff',
		'image/tif',
		'text/plain'
	];

	onMount(() => {
		if(data.length==0){
			data_valid = false
		}
	});

	// --- handle dropped/uploaded files
	async function handleFileChange(event) {
		const { acceptedFiles } = event.detail;
		progress = 0;
		files = [];
		for (let f of acceptedFiles) {
			if (f.name.endsWith('.zip')) {
				await extractZip(f);
			} else {
				files = [...files, f];
				//files.push(f);
				//files = files; // trigger reactive update
			}
		}
		categorizeFiles();
		loadFiles()
	}

	// --- unzip support
	async function extractZip(file) {
		try {
			const zip = await JSZip.loadAsync(file);
			const entries = Object.values(zip.files);

			for (const entry of entries) {
				// skip macOS metadata files
				if (
					entry.dir ||
					entry.name.startsWith('__MACOSX/') ||
					entry.name.split('/').pop().startsWith('._')
				) {
					continue;
				}

				const blob = await entry.async('blob');
				const f = new File([blob], entry.name, { type: getMime(entry.name) });
				files.push(f);
				files = files; 
			}
		} catch (e) {
			error = 'Failed to read zip: ' + e.message;
		}
	}

	// --- simple mime guesser for zip entries
	function getMime(name) {
		if (/\.(png|jpg|jpeg)$/i.test(name)) return 'image/jpeg';
		if (/\.(tif|tiff)$/i.test(name)) return 'image/tiff';
		if (/\.(mp4|webm)$/i.test(name)) return 'video/mp4';
		if (/\.txt$/i.test(name)) return 'text/plain';
		return 'application/octet-stream';
	}

	// --- categorize and count
	let summary = $state({});
	function categorizeFiles() {
		let images = 0,
			videos = 0,
			texts = 0,
			unknown = 0;
		for (let f of files) {
			if (f.type.startsWith('image/')) images++;
			else if (f.type.startsWith('video/')) videos++;
			else if (f.type === 'text/plain') texts++;
			else unknown++;
		}
		hasVideo = videos > 0;
		summary = { images, videos, texts, unknown };
	}


	// --- load all files into Data[]
	async function loadFiles1() {
		data = [];
		data_valid = false;
		error = '';
		progress = 0;

		try {
			let count = 0;
			// for (let f of files) {
			// 	const options = f.type.startsWith('video/') ? { fps } : {};
			// 	let all_opts = { ...browserOptions, meta: options };
			// 	let d = new Data(f, all_opts);
			// 	await d.load();

			// 	data.push(d);
			// 	count++;
			// 	progress = Math.round((count / files.length) * 100);
				
			// }
			console.log(files)
			data_valid = files.length > 0;
			console.log(data_valid)
			data_error=""
			let d = {data:files,data_valid,options:{fps},data_error}
			data_emit({...d})
		} catch (e) {
			data_error = 'Error loading files: ' + e.message;
			data_emit({data_valid,data_error})
		}
	}

	async function loadFiles() {
	data = [];
	data_valid = false;
	error = '';
	progress = 0;

	try {
		// --- save raw files in the store here
		filesStore.set([...files]);

		data_valid = files.length > 0;
		data_error = "";
		let d = { data: files, data_valid, options: { fps }, data_error };
		data_emit({ ...d });
	} catch (e) {
		data_error = 'Error loading files: ' + e.message;
		data_emit({ data_valid, data_error });
	}
}


	// async function handleUpload() {
	// 	if (!file) {
	//     alert('Please select a file.');
	//     return;
	//   }
	//   let metadata = {
	//     "type":"something"
	//   }
	//   const formData = new FormData();
	//   formData.append('file', file);
	//   formData.append('metadata', JSON.stringify(metadata));

	//   try {
	//     let url = settings.backendURL
	//     const response = await axios.post(url+'/action/inference', formData, {
	//       headers: {
	//         'Accept': 'application/json'
	//       }
	//     });

	//     console.log('Response:', response.data);
	//     alert('File uploaded and processed successfully.');
	//   } catch (err) {
	//     console.error('Upload error:', err);
	//     alert('Failed to upload file.');
	//   }
	// }

	// import { load_input } from 'dlonwebjs';

	// async function loadFile() {
	// 	data = null;
	// 	data_valid = false;
	// 	error = '';

	// 	if (!file) {
	// 		error = 'No file selected.';
	// 		return;
	// 	}

	// 	if (!allowedTypes.includes(file.type)) {
	// 		error = 'Unsupported file type.';
	// 		data_valid = false;
	// 		return;
	// 	}

	// 	try {
	// 		const input_options = isVideo ? { fps } : {};
	// 		let all_options = { ...browserOptions, meta: input_options };
	// 		data = new Data(file, all_options);
	// 		await data.load();
	// 		data_valid = true;
	// 		error = '';
	// 		console.log('Data loaded:', data);
	// 	} catch (e) {
	// 		data = null;
	// 		data_valid = false;
	// 		error = 'Error in loading data: ' + e.message;
	// 	}
	// }

</script>
<div>
	<Dropzone containerClasses="dropzone11" on:drop={handleFileChange} multiple={true}>

		<p>{$translations.input_dd}</p>
	</Dropzone>




<div class="d-flex">
  <div class="p-2 flex-fill">
		{#if files.length}
		<div class="mt-2 text-success">
			<p>
				<b>Found:</b>
				{#if summary.images > 0}{summary.images} images{/if}
				{#if summary.videos > 0}{summary.videos} videos{/if}
				{#if summary.texts > 0}{summary.texts} text files{/if}
				{#if summary.unknown > 0}{summary.unknown} unrecognized{/if}
			</p>
		</div>
	{/if}
	</div>
</div>

	{#if hasVideo}
	<h6 class="text-secondary">{$translations.input_options}</h6>

<div class="input-group flex-nowrap">

  <span class="input-group-text" id="addon-wrapping"> {$translations.video_fps} </span>
  <input class="form-control" type="number" min="1" max="60" bind:value={fps} aria-label="Username" aria-describedby="addon-wrapping">
</div>
	{/if}
	{#if progress > 0 && progress < 100}
		<div class="progress mt-2">
			<div class="progress-bar" style="width:{progress}%"></div>
		</div>
	{/if}

	{#if data_error}
		<div class="alert alert-danger mt-2">{data_error}</div>
	{/if}

	<!-- <div class="mt-2">
		<button class="btn btn-success" onclick={loadFiles} disabled={!files.length}>
			Load files
		</button>
	</div> -->


</div>

<style>
	.dropzone11 {
		border: 2px dashed var(--bs-border-color);
		border-radius: 0.375rem;
		padding: 1rem;
		text-align: center;
	}
	.progress {
		height: 6px;
		background: #ddd;
	}
	.progress-bar {
		height: 100%;
		background: green;
	}
</style>
