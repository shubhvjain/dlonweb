<script>
	import { onMount } from 'svelte';
	import { Library, InferenceTask, Data } from 'dlonwebjs';
	import { browserOptions } from '$lib/data.browser';
	import {getAllSettings} from "$lib/settings"

	import axios from 'axios';
	let {
		input,
		input_valid = $bindable(),
		model_name,
		model = $bindable(),
		model_valid = $bindable(false),
		output = $bindable(),
		on_emit_output
	} = $props();

	let modelList = $state([]);
	let loaded = $state(false);
	let error = $state('');
	let select_model = $state('');
	let select_location = $state('browser');
	let custom_model_used = $state(false);
	let settings = $state()

	let task_running = $state(false);
	let task_run_status = $state('');

	$effect(() => {
		check_valid();
	});

	const check_valid = () => {
		let er = [];
		if (!model) {
			er.push('No model selected for inference task');
		}
		if (!input_valid) {
			er.push('Input is not valid');
		}
		if (er.length > 0) {
			model_valid = false;
		}
		error = er.join(',');
	};

	const load_model_list = async () => {
		modelList = await Library.get_model_list();
	};

	const load_selected_model = async (name) => {
		try {
			if (name) {
				if (name == 'custom') {
					// to use user's own model
					// model = await Library.get_model(name);
					model_valid = false;
					custom_model_used = true;
					error = 'Upload your model files (.json + .bin)';
				} else {
					model = await Library.get_model(name);
					model_valid = true;
					custom_model_used = false;
					error = '';
				}
			} else {
				model_valid = false;
				model = null;
				error = 'Select a model';
				custom_model_used = false;
			}
		} catch (err) {
			model_valid = false;
			console.log(error);
			error = err.message;
		}
	};

	const load = async () => {

		await load_model_list();
		if (model_name) {
			await load_selected_model(model_name);
			select_model = model_name;
			loaded = true;
		} else {
			console.log(model_name);
			loaded = true;
			error = 'Select a model';
		}
	};

	onMount(async () => {
		await load();
		settings = getAllSettings()

	});

	const inference_pipeline = async () => {
		try {
			// step 1 : load the model
			task_running = true;
			task_run_status = 'Starting the inference pipeline';

			if (!model) {
				task_running = false;
				task_run_status = 'No model selected';
			}
			if (select_location == 'browser') {
				let options = { ...browserOptions, modelName: select_model };

				let task = new InferenceTask(options);

				await task.loadModel();
				//let task1 = new InferenceTask(model.type, input, { libraryModelName: select_model });
				//await task1.load();
				task_run_status = 'Model loaded successfully on browser. Running the model now ';
				// step 2 : run the model
				console.log(task);
				console.log(typeof input);
				output = await task.runInference(input);
				console.log(output);
				task_run_status = 'Model run. Output is created';
				console.log('done');

				// step 3 : show the output

				task_running = false;
				//task_run_status = 'Done';
				if (on_emit_output) {
					on_emit_output(output);
				}
			} else if (select_location == 'server') {
				// check if url provided
				// check if server reachable
				// send request
				task_run_status = 'Uploading input to server for inference';

				// 1. Convert Data to Blob or base64 before sending
				let metadata = {
					modelName: select_model,
					... input.meta
				};
				const formData = new FormData();
				formData.append('file', input.input);
				formData.append('metadata', JSON.stringify(metadata));

				// 2. Send it to your inference endpoint
				let server_url = settings.backendURL
				const response = await axios.post(`${server_url}/action/inference`, formData, {
					headers: {
          'Accept': 'application/json'
        }
				});

				const { buffer, meta } = response.data;

				// 3. Rebuild Data object from server response
				const binary = Uint8Array.from(atob(buffer), (c) => c.charCodeAt(0));
				const outputBlob = new Blob([binary], { type: meta.mimeType });
				const outputFile = new File([outputBlob], meta.fileName || 'output.dat', {
					type: meta.mimeType
				});
				console.log(outputFile)
				output = new Data(outputFile, {
					env: browserOptions.env,
					kind: meta.kind,
					structure: meta.structure,
					meta: meta.meta
				});
				await output.load();

				task_run_status = 'Inference complete on server';

				if (on_emit_output) {
					on_emit_output(output);
				}

				task_running = false;
			}
		} catch (err) {
			console.log(err);
			task_running = false;
			task_run_status = `Error : ${err.message}`;
		}
	};
</script>

<!-- {input_valid} -->
<div class="d-flex border-bottom1 mb-2">
	<div class="p-1 flex-grow-1">
		<h4 class={model_valid ? 'text-success' : 'text-danger'}>Task Selection</h4>
	</div>
	<div class="p-2">
		{#if model}
			{#if model_valid}
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
<select
	class="form-select mb-3"
	aria-label="select model"
	onchange={() => load_selected_model(select_model)}
	bind:value={select_model}
>
	<option value="" selected>Select</option>
	{#each modelList as m}
		<option value={m.value}> {m.label} </option>
	{/each}
	<option value="custom">Use Your Own Tensorflow Model</option>
</select>

{#if custom_model_used}
	Upload your model
{/if}

{#if model}{model.title}{/if}
<div class="mb-3 mt-3 row">
	<label for="inputPassword" class="col-sm-3 col-form-label">Run task on </label>
	<div class="col-sm-9">
		<select class="form-select mb-3" aria-label="select model" bind:value={select_location}>
			<option value="browser" selected>Browser</option>
			<option value="server">Server</option>
		</select>
	</div>
</div>

<div class="d-flex border-bottom1 mb-2">
	<div class="p-2 flex-grow-1">
		{#if error}
			<span class="text-danger"> {error} </span>
		{/if}
	</div>
	<div class="p-2">
		<button
			class="btn btn-success"
			disabled={task_running ? 'disable' : error ? 'disable' : ''}
			onclick={inference_pipeline}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				fill="currentColor"
				class="bi bi-play-fill"
				viewBox="0 0 16 16"
			>
				<path
					d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"
				/>
			</svg>
			Run
		</button>
	</div>
</div>

<div class="d-flex border-bottom1 mb-2">
	<div class="p-2 flex-grow-1">
		{#if task_run_status}
			<span class="text-primary"> {task_run_status} </span>
		{/if}
	</div>
	<div class="p-2">
		{#if task_running}
			<div class="loader"></div>
		{/if}
	</div>
</div>

<style>
	.loader {
		width: 120px;
		height: 20px;
		background: linear-gradient(#000 0 0) left/20px 20px no-repeat #ddd;
		animation: l1 1s infinite linear;
	}
	@keyframes l1 {
		50% {
			background-position: right;
		}
	}
</style>
