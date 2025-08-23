<script>
	import { onMount, onDestroy } from 'svelte';
	import { Library, Data } from 'dlonwebjs';
	import { translations, userSettings } from '$lib/utils/store.js';
	import Input from './_Input.svelte';
	import { InferencePipeline } from '$lib/utils/inferencePipeline.js';
	import { filesStore } from '$lib/utils/filesStorage';
	import { get } from 'svelte/store';

	let { model_valid = $bindable(false), model_name, on_emit_output } = $props();

	let input_valid = $state(false);
	let input_data = $state([]);
	let input_options = $state({});
	let worker = $state();
	let error = $state('');
	let progress = $state({ current: 0, total: 0, percentage: 0 });
	let status = $state('');
	let model_details = $state({ title: '', description: '' });
	let modelList = $state([]);
	let loaded = $state(false);
	let select_model = $state('');
	let select_location = $state('browser');
	let custom_model_used = $state(false);
	let task_running = $state(false);
	let task_run_status = $state('');
	let output = $state();
	let pipeline = $state();

	const on_input_valid = (opt) => {
		input_valid = opt.data_valid;
		console.log(opt);
		if (input_valid) {
			input_data = $state.snapshot(filesStore);
			console.log(input_data);
			input_options = opt.options;
		}
		check_valid();
	};

	onMount(async () => {
		await load_model_list();

		if (model_name) {
			await load_selected_model(model_name);
			select_model = model_name;
		}

		loaded = true;
	});

	onDestroy(() => {
		if (pipeline) {
			pipeline.terminate();
		}
	});

	const check_valid = () => {
		let er = [];
		if (!select_model) {
			er.push('No model selected for inference task');
			model_valid = false;
		}
		if (!input_valid) {
			er.push('Input is not valid');
		}
		error = er.join(', \n');
		model_valid = er.length === 0;
	};

	const load_model_list = async () => {
		modelList = await Library.get_model_list();
	};

	const load_selected_model = async (name) => {
		if (name === 'custom') {
			model_valid = false;
			custom_model_used = true;
			error = 'Upload your model files (.json + .bin)';
		} else {
			custom_model_used = false;
			model_details = modelList.find((itm) => itm.value === name);
			model_valid = true;
			error = '';
		}
		check_valid();
	};

	$effect(() => {
		check_valid();
	});

	const sanitizeJSON = (jsn) => {
		return JSON.parse(JSON.stringify(jsn));
	};

	// Start the inference pipeline
	const inference_pipeline = async () => {
		if (!select_model || !input_valid) {
			task_run_status = 'Model or input invalid';
			return;
		}

		task_running = true;
		progress = { current: 0, total: 0, percentage: 0 };
		error = '';
		task_run_status = 'Initializing...';

		try {
			// Create worker if not already exists
			if (!worker) {
				worker = new Worker(new URL('$lib/utils/inference.worker.js', import.meta.url), {
					type: 'module'
				});
			}

			// Create or recreate pipeline
			pipeline = new InferencePipeline(select_location, 'web_worker', worker);

			task_run_status = 'Loading model...';

			// Progress callback
			const onProgress = (p) => {
				progress = {
					current: p.current,
					total: p.total,
					percentage: p.total > 0 ? (p.current / p.total) * 100 : 0
				};
				task_run_status = `Processing ${p.current}/${p.total}`;
			};

			task_run_status = 'Processing Input';

			// Run inference
			const filesArray = Array.from(get(filesStore));

			if (filesArray.length == 0) {
				throw new Error('No input files available');
			}

			/*
    inputFiles = [],
		modelDetails = { name: '', model: null },
		runOptions = { location: 'browser', mode: 'web_worker', worker: null },
		onProgress = () => {}
    
    */

			output = await pipeline.run(
				filesArray,
				sanitizeJSON({ name: select_model }),
				{ location: 'browser', mode: 'main_thread' },
				onProgress
			);

			task_run_status = 'Inference completed!';
			console.log('Pipeline output:', output);
		} catch (err) {
			console.error('Pipeline error:', err);
			error = `Pipeline failed: ${err.message}`;
			task_run_status = 'Pipeline failed';
		} finally {
			task_running = false;
			// Reset progress after a delay to show completion
			setTimeout(() => {
				progress = { current: 0, total: 0, percentage: 0 };
			}, 2000);
		}
	};

	// Cancel the running pipeline
	const cancel_pipeline = () => {
		if (pipeline && task_running) {
			pipeline.cancel();
			task_run_status = 'Cancelling...';
			task_running = false;
			progress = { current: 0, total: 0, percentage: 0 };

			setTimeout(() => {
				task_run_status = 'Pipeline cancelled';
			}, 500);
		}
	};
</script>

<div class="p-1 mb-2 pt-2">
	<!-- {#if workerRunning}<p>Progress: {progress.percentage.toFixed(1)}%</p>{/if} -->
	<h4 class="mb-2">1. {$translations.choose_model}</h4>

	<select
		class="form-select form-select-lg mb-2"
		aria-label="select model"
		onchange={() => load_selected_model(select_model)}
		bind:value={select_model}
	>
		<option value="" selected>Select</option>
		{#each modelList as m}
			<option value={m.value}> {m.label[$userSettings['language']]} </option>
		{/each}
		<!-- <option value="custom">Use Your Own Tensorflow Model</option> -->
	</select>

	{#if custom_model_used}
		<div class="alert alert-info p-2 m-2">
			<strong>Custom Model:</strong> Upload your model files (.json + .bin)
		</div>
	{/if}

	{#if select_model}
		<div class="alert alert-light" role="alert">
			<p>{model_details.description[$userSettings['language']]}</p>
		</div>
	{/if}
</div>

<div class="p-1 mb-2 border-top pt-4">
	<h4>2. {$translations.upload_data}</h4>
	<Input data_emit={on_input_valid} />
</div>

<div class="p-1 mb-2 mt-2 border-top pt-4">
	<h4>3. {$translations.inference_options}</h4>

	<div class="mb-3 mt-3 row">
		<label for="execution-location" class="col-sm-3 col-form-label">Run task on</label>
		<div class="col-sm-9">
			<select
				class="form-select mb-3"
				aria-label="select execution location"
				bind:value={select_location}
				id="execution-location"
			>
				<option value="browser" selected>Browser</option>
				<option value="server">Server</option>
			</select>
		</div>
	</div>
</div>
<!-- <hr> -->
<div class="d-flex align-items-center p-1 border-top pt-4">
	<!-- Left section: Error / Progress / Status -->
	<div class="flex-grow-1 me-3">
		{#if error}
			<div class="text-danger mb-2">{error}</div>
		{/if}

		{#if task_running && progress.total > 0}
			<div class="mb-2">
				<div class="progress">
					<div
						class="progress-bar progress-bar-striped progress-bar-animated"
						role="progressbar"
						style="width: {progress.percentage}%"
						aria-valuenow={progress.percentage}
						aria-valuemin="0"
						aria-valuemax="100"
					>
						{Math.round(progress.percentage)}%
					</div>
				</div>
				<p class="text-muted">Processing {progress.current}/{progress.total}</p>
			</div>
		{/if}

		{#if task_run_status}
			<div class="text-primary">{task_run_status}</div>
		{/if}
	</div>

	<!-- Center section: Loader -->
	<!-- <div class="me-3">
				{#if task_running}
					<div class="loader"></div>
				{/if}
			</div> -->

	<!-- Right section: Buttons -->
	<div class="d-flex flex-column">
		<button
			class="btn btn-lg btn-success mb-2"
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
			Run
		</button>

		{#if task_running}
			<button class="btn btn-link" onclick={cancel_pipeline}> Cancel </button>
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
</style>
