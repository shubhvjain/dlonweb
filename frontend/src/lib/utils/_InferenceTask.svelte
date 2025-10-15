<script>
	/**
	 * Inference Task Component
	 *
	 * Manages machine learning model inference in the browser using TensorFlow.js.
	 * Handles model selection, input file validation, web worker execution, and progress tracking.
	 *
	 * Props:
	 * - component_valid: Bindable flag indicating if component is ready to run
	 * - model_name: Optional pre-selected model name
	 * - emit_output: Callback function that receives inference results
	 * - task_running: Bindable flag indicating if inference is currently executing
	 */
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import axios from 'axios';

	import { Library, Data, InferenceTask } from 'dlonwebjs';
	import { adaptor } from '$lib/utils/adapter.browser';
	import { translations, userSettings } from '$lib/utils/store.js';
	import Input from './_Input.svelte';
	import { filesStore } from '$lib/utils/filesStorage';
	import Loading from './_Loading.svelte';
	import { SYSTEM_SETTINGS } from './settings.js';

	// Component props
	let {
		component_valid = $bindable(false),
		model_name,
		emit_output = () => {},
		task_running = $bindable(false)
	} = $props();

	// UI state
	let error = $state('');
	let loaded = $state(false);
	let status = $state({ type: 'danger', text: '' });
	const set_error = (text) => {
		status = { type: 'danger', text };
	};
	const set_success = (text) => {
		status = { type: 'success', text };
	};

	let dev_mode = $state(false);
	let options_enabled = $state(false);
	let app_options = $state({});

	// Input management
	let input_valid = $state(false);
	let input_options = $state({});

	// Model management
	let selected_model = $state('');
	let custom_model_used = $state(false);
	let model_details = $state({ title: '', description: '' });
	let modelList = $state([]);

	// Web worker and inference state
	let worker = $state();
	let workerListener = $state();
	let progress = $state({ percent: 0 });
	let select_location = $state('browser');
	let pipeline = $state();

	// Model output
	let output = $state();

	onMount(async () => {
		await load_page();
		//task_running = true
		app_options = SYSTEM_SETTINGS.sections;
		console.log(app_options);
		console.log($userSettings);
	});

	/**
	 * To load the component. loads model if already selected or show a list of available models
	 */
	const load_page = async () => {
		await load_model_list();
		if (model_name) {
			await select_model(model_name);
			selected_model = model_name;
		}
		loaded = true;
	};

	/**
	 * Callback from Input component - validates uploaded files and options
	 */
	const on_input_valid = (opt) => {
		input_valid = opt.data_valid;
		// console.log(opt);
		if (input_valid) {
			input_options = opt.options;
		}
		check_valid();
	};

	/**
	 * Validates component state - checks if both model and input are ready
	 */
	const check_valid = () => {
		let er = [];
		if (!selected_model) {
			er.push($translations['no_model']);
			//component_valid = false;
		}
		if (!input_valid) {
			er.push($translations['no_input']);
		}
		//error = er.join(', \n');
		if (er.length > 0) {
			set_error(er.join(', \n'));
		} else {
			set_success('');
		}
		component_valid = er.length === 0;
	};

	/**
	 * Loads the list of model and its metadata from the model library.
	 */
	const load_model_list = async () => {
		modelList = await Library.get_model_list();
	};

	/**
	 * To select a model
	 * @param name the model name
	 */
	const select_model = async (name) => {
		if (name === 'custom') {
			component_valid = false;
			custom_model_used = true;
			error = 'Upload your model files (.json + .bin)';
		} else {
			custom_model_used = false;
			model_details = modelList.find((itm) => itm.value === name);
			component_valid = true;
			error = '';
		}
		check_valid();
	};

	// TODO use derive instead
	$effect(() => {
		check_valid();
	});

	const sanitize_JSON = (jsn) => {
		return JSON.parse(JSON.stringify(jsn));
	};

	function updateProgressFromPercent(pct) {
		const p = Math.max(0, Math.min(100, Number(pct) || 0));
		progress = { percent: p };
	}

	/**
	 * Executes ML inference pipeline in a web worker
	 * Steps: Create worker ->  Load data -> Preprocess -> Run model ->  Return results
	 */
	const inference_pipeline = async () => {
		try {
			if (!selected_model) {
				throw new Error($translations['pipeline_01']);
			}
			if (!input_valid) {
				throw new Error($translations['pipeline_02']);
			}

			if (select_location == 'browser') {
				task_running = true;
				progress = { percent: 0 };
				set_success($translations['pipeline1']);

				// Create worker if not already exists
				if (!worker) {
					worker = new Worker(new URL('$lib/utils/inference.worker.js', import.meta.url), {
						type: 'module'
					});
				}

				// 2) (re)attach a single listener for progress/error coming from worker
				if (workerListener && worker) {
					worker.removeEventListener('message', workerListener);
				}

				let rejectWorkerError;
				const workerErrorPromise = new Promise((_, reject) => (rejectWorkerError = reject));

				workerListener = (ev) => {
					const msg = ev?.data;
					if (!msg || typeof msg !== 'object') return;

					if (msg.type === 'progress') {
						// the worker sends progress update { type: 'progress', percent }
						updateProgressFromPercent(msg.percent);
						set_success(`Progress : ${Math.round(progress.percent)}%`);
					} else if (msg.type === 'error') {
						// worker encountered error
						rejectWorkerError(new Error(msg.error || 'Worker error'));
					} else if (msg.type === 'done') {
						// nothing to do here; InferenceTask.run_model will resolve with output_map
					}
				};
				worker.addEventListener('message', workerListener);

				// 3) gather files
				const filesArray = Array.from(get(filesStore) || []);
				if (filesArray.length === 0) {
					throw new Error($translations['no_input']);
				}

				// 4) build Data (preprocess on load — e.g., decode video to frames)
				set_success($translations['pipeline20']);
				const data = new Data(adaptor, filesArray, sanitize_JSON(input_options));
				await data.load();
				set_success($translations['pipeline21']);

				// 5) prepare inference task in web_worker mode
				const task = new InferenceTask({
					env: adaptor,
					model_name: selected_model,
					run_mode: 'web_worker',
					worker
				});

				await task.load_data(data);
				set_success($translations['pipeline3']);

				// 6) run model; combine task callback + worker progress
				const runPromise = task.run_model((pct) => {
					// some models / pipelines report their own percent callback
					updateProgressFromPercent(pct);
				});

				const result = await Promise.race([runPromise, workerErrorPromise]);
				// If the race resolved from runPromise, grab its value; if it was the worker error,
				// the catch below will handle it.
				
				output = result || (await runPromise);
				let final_output ;
				try {
					set_success($translations['pipeline8']);
					final_output = await task.generate_outputs();	
				} catch (error) {
					console.log(error)
				}
				
				console.log(final_output);
				set_success($translations['pipeline4']);
				//console.log('Pipeline output:', output);
				//console.log(task)
				task_running = false;

				emit_output(final_output);
			} else if (select_location == 'server') {
				// check if url provided
				// check if server reachable
				// send request

				task_running = true;
				progress = { percent: 0 };

				set_success($translations['pipeline5']);

				// Gather files (same as browser mode)
				const filesArray = Array.from(get(filesStore) || []);

				if (filesArray.length === 0) {
					throw new Error($translations['no_input']);
				}

				console.log(filesArray);

				// Prepare form data
				const formData = new FormData();

				// Add all files
				filesArray.forEach((file) => {
					formData.append('files', file);
				});

				// Add model name and options
				formData.append('model_name', selected_model);
				formData.append('input_options', JSON.stringify(sanitize_JSON(input_options)));

				// 2. Send it to your inference endpoint
				let server_url = $userSettings.backendURL;
				const response = await axios.post(`${server_url}/inference`, formData, {
					headers: {
						Accept: 'application/json'
					}
				});

				console.log(response.data)
				let final_output =  deserializeFromHTTP(response.data)

				//const { buffer, meta } = response.data;



				// 3. Rebuild Data object from server response
				// const binary = Uint8Array.from(atob(buffer), (c) => c.charCodeAt(0));
				// const outputBlob = new Blob([binary], { type: meta.mimeType });
				// const outputFile = new File([outputBlob], meta.fileName || 'output.dat', {
				// 	type: meta.mimeType
				// });
				// console.log(outputFile);
				// output = new Data(outputFile, {
				// 	env: browserOptions.env,
				// 	kind: meta.kind,
				// 	structure: meta.structure,
				// 	meta: meta.meta
				// });
				// await output.load();

				//task_run_status = 'Inference complete on server';

				if (emit_output) {
					emit_output(final_output);
				}
				set_success($translations['pipeline4']);
				task_running = false;
			}
		} catch (err) {
			console.log(err);
			task_running = false;
			set_error(
				`Pipeline failed: ${err.message || 'Unexpected error occurred. Please check the input.'}`
			);
			console.error('Pipeline error:', err);
		}
	};

	// Todo : fix this. Not in use
	const cancel_pipeline = () => {
		if (pipeline && task_running) {
			pipeline.cancel();
			set_error('Cancelling');
			task_running = false;
			progress = { percent: 0 };

			setTimeout(() => {
				set_success('Inference pipeline stopped');
			}, 500);
		}
	};

	/**
	 * Deserialize output data from HTTP response (Browser only)
	 * Converts base64 strings back to File objects
	 *
	 * @param {Object} serializedData - Data received from server
	 * @returns {Object} Output data with File objects
	 */
	const deserializeFromHTTP = (serializedData) => {
		return {
			...serializedData,
			files: serializedData.files.map((fileEntry) => ({
				...fileEntry,
				input: _base64ToFile(fileEntry.input),
				outputs: fileEntry.outputs.map((output) => ({
					...output,
					file: _base64ToFile(output.file)
				}))
			}))
		};
	};

	/**
	 * Convert base64 object to File (Browser helper)
	 * @private
	 */
	const _base64ToFile = (fileObj) => {
		const byteString = atob(fileObj.data);
		const arrayBuffer = new ArrayBuffer(byteString.length);
		const uint8Array = new Uint8Array(arrayBuffer);

		for (let i = 0; i < byteString.length; i++) {
			uint8Array[i] = byteString.charCodeAt(i);
		}

		const blob = new Blob([arrayBuffer], { type: fileObj.type });
		return new File([blob], fileObj.name, { type: fileObj.type });
	};

	// Dev utility
	const test_tensor_generation = async () => {
		try {
			console.log('testing data');
			const filesArray = Array.from(get(filesStore));
			if (filesArray.length == 0) {
				throw new Error('No input files available');
			}
			let testdata = new Data(adaptor, filesArray, input_options);
			await testdata.load();
			//console.log('data loaded');
			//console.log(testdata);

			let model_details = await Library.get_model_options(selected_model);
			//console.log(model_details);

			await testdata.create_tensors(selected_model, model_details);
			console.log(testdata);
		} catch (error) {
			console.log(error);
		}
	};

	onDestroy(() => {
		try {
			if (workerListener && worker) worker.removeEventListener('message', workerListener);
			worker?.terminate();
		} catch (e) {}
		worker = null;
		workerListener = null;
	});
</script>

<div class="card">
	<div class="card-header">
		{$translations.inference}
	</div>
	<div class="card-body">
		<div class="p-1 mb-2 pt-2">
			<!-- {#if workerRunning}<p>Progress: {progress.percentage.toFixed(1)}%</p>{/if} -->

			{#if !model_name}
				<h5 class="card-title">1. {$translations.choose_model}</h5>
			{/if}

			<select
				class="form-select form-select-lg"
				aria-label="select model"
				onchange={() => select_model(selected_model)}
				bind:value={selected_model}
				disabled={model_name}
			>
				<option value="" selected>Select</option>
				{#each modelList as m}
					<option value={m.value}> {m.label[$userSettings['language']]} </option>
				{/each}
				<!-- <option value="custom">Use Your Own Tensorflow Model</option> -->
			</select>

			{#if custom_model_used}
				<div class="alert alert-info">
					<strong>Custom Model:</strong> Upload your model files (.json + .bin)
				</div>
			{/if}

			{#if selected_model}
				<div class="alert alert-light" role="alert">
					<p>{model_details.description[$userSettings['language']]}</p>
				</div>
			{/if}
		</div>

		<div class="p-1 mb-2 pt-4">
			{#if model_name}
				<h5 class="card-title">{$translations.upload_data}</h5>
			{:else}
				<h5 class="card-title">2. {$translations.upload_data}</h5>
			{/if}

			<Input data_emit={on_input_valid} />
		</div>

		{#if app_options.inference_settings}
			<details class="p-1 mb-2 mt-2 border-top pt-4">
				<summary>
					{#if model_name}
						<h5 class="card-title d-inline">{$translations.inference_options}</h5>
					{:else}
						<h5 class="card-title d-inline">3. {$translations.inference_options}</h5>
					{/if}
				</summary>

				<div class="mb-3 mt-3 row">
					<label for="execution-location" class="col-sm-3 col-form-label"
						>{$translations.inference_label1}</label
					>
					<div class="col-sm-9">
						<select
							class="form-select mb-3"
							aria-label="select execution location"
							bind:value={select_location}
							id="execution-location"
						>
							<option value="browser" selected>{$translations.inference_label2}</option>
							<option value="server">{$translations.inference_label3}</option>
						</select>
					</div>
				</div>
			</details>
		{/if}
		<div class="d-flex align-items-center p-1 pt-2">
			<div class="flex-grow-1 me-3">
				{#if status.text}
					{#if task_running}
						<Loading message={status.text} />
					{:else}
						<div class="text-{status.type} mb-2">{status.text}</div>
					{/if}
				{/if}

				{#if task_running && progress.percent > 0}
					<div aria-live="polite" style="margin-top: .5rem;">
						<progress max="100" value={progress.percent}></progress>
						<span style="margin-left:.5rem;">{progress.percent}%</span>
					</div>
				{/if}
			</div>

			<div class="d-flex flex-column">
				<button
					class="btn btn-lg btn-primary mb-2"
					disabled={task_running || error}
					onclick={inference_pipeline}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="30"
						height="30"
						fill="currentColor"
						class="bi bi-play-fill"
						viewBox="0 0 16 16"
					>
						<path
							d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"
						/>
					</svg>
					{$translations['run']}
				</button>

				<!-- {#if task_running}
				<button class="btn btn-link" onclick={cancel_pipeline}> Cancel </button>
			{/if} -->
			</div>
		</div>

		{#if dev_mode}
			<div>
				<button class="btn btn-link" onclick={test_tensor_generation}>
					Test tensor generation
				</button>
			</div>
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

	.progress {
		height: 8px;
	}

	select.form-select:disabled {
		background-image: none;
	}
</style>
