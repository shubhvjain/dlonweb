<script>
	import { onMount, onDestroy } from 'svelte';

	import { Library, Data, InferenceTask } from 'dlonwebjs';
	import { adaptor } from '$lib/utils/adapter.browser';

	import { translations, userSettings } from '$lib/utils/store.js';
	import Input from './_Input.svelte';

	import { filesStore } from '$lib/utils/filesStorage';
	import { get } from 'svelte/store';
	import Loading from './_Loading.svelte';

	/**
	 * The Component inputs  includes :
	 * - `component_valid` : a bindable flag that indicates if the model is valid or not
	 * - `model_name` : to select a model name by default
	 * - `emit_output` : this is a method that other components can use to get the output of the model
	 */
	let {
		component_valid = $bindable(false),
		model_name,
		emit_output = () => {},
		task_running = $bindable(false)
	} = $props();

	// to manage the over component
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

	// To manage input
	let input_valid = $state(false);
	let input_options = $state({});

	// To manage model
	let selected_model = $state(''); // name of the selected model
	let custom_model_used = $state(false);
	let model_details = $state({ title: '', description: '' });
	let modelList = $state([]); // list of all models in the library

	// To manage model running
	let worker = $state();
	let workerListener = $state();

	let progress = $state({ percent: 0 });
	let select_location = $state('browser');
	let pipeline = $state();

	// output of the model
	let output = $state();

	onMount(async () => {
		await load_page();
		//task_running = true
	});

	/**
	 * to load the component
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
	 * This method is bound to the on_input_emit of the _Input component.
	 * It updates the input files uploaded by the user, other input related options and a flag to indicate if input is valid overall
	 * @param opt
	 *
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
	 *  check if the component as a whole is in a valid state.
	 * this has 2 aspects: the model and the input data
	 */
	const check_valid = () => {
		let er = [];
		if (!selected_model) {

			er.push($translations["no_model"]);
			//component_valid = false;
		}
		if (!input_valid) {
			er.push($translations["no_input"]);
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

	const sanitizeJSON = (jsn) => {
		return JSON.parse(JSON.stringify(jsn));
	};

	function updateProgressFromPercent(pct) {
		const p = Math.max(0, Math.min(100, Number(pct) || 0));
		progress = { percent: p };
	}

	/**
	 * To run the inference task on the input provided
	 */
	const inference_pipeline = async () => {
		try {
			if (!selected_model || !input_valid) {
				throw new Error($translations["pipeline_invalid"]);
			}
			task_running = true;
			progress = { percent: 0 };
			set_success($translations["pipeline1"]);

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
					// your worker posts { type: 'progress', percent }
					updateProgressFromPercent(msg.percent);
					set_success(`Progress : ${Math.round(progress.percent)}%`);
				} else if (msg.type === 'error') {
					// surface worker error (in case InferenceTask doesn't already reject)
					rejectWorkerError(new Error(msg.error || 'Worker error'));
				} else if (msg.type === 'done') {
					// nothing to do here; InferenceTask.run_model will resolve with output_map
				}
			};
			worker.addEventListener('message', workerListener);

			// 3) gather files
			const filesArray = Array.from(get(filesStore) || []);
			if (filesArray.length === 0) {
				throw new Error($translations["no_input"]);
			}

			// 4) build data (preprocess on load — e.g., decode video → frames)
			set_success($translations["pipeline1"]);
			const data = new Data(adaptor, filesArray, sanitizeJSON(input_options));
			await data.load();
			set_success($translations["pipeline2"]);

			// 5) prepare inference task in web_worker mode
			const task = new InferenceTask({
				env: adaptor, // must include tf + basePath
				model_name: selected_model, // e.g. "tf.coco-ssd"
				run_mode: 'web_worker',
				worker
			});

			await task.load_data(data);
			set_success($translations["pipeline3"])

			// 6) run model; combine task callback + worker progress
			const runPromise = task.run_model((pct) => {
				// some models / pipelines report their own percent callback
				updateProgressFromPercent(pct);
			});

			const result = await Promise.race([runPromise, workerErrorPromise]);
			// If the race resolved from runPromise, grab its value; if it was the worker error,
			// the catch below will handle it.
			output = result || (await runPromise);
			set_success($translations["pipeline4"])
			console.log('Pipeline output:', output);
			//console.log(task)
			task_running = false;
			emit_output(task);
		} catch (err) {
			console.log(err)
			task_running = false;
			set_error(`Pipeline failed: ${err.message||"Unexpected error occurred. Please check the input."}`);
			console.error('Pipeline error:', err);
		}
	};

	// Cancel the running pipeline
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
			<h5 class="card-title">1. {$translations.choose_model}</h5>

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
			<h5 class="card-title">2. {$translations.upload_data}</h5>
			<Input data_emit={on_input_valid} />
		</div>

		{#if options_enabled}
			<details class="p-1 mb-2 mt-2 border-top pt-4">
				<summary>
					<h5 class="card-title d-inline">3. {$translations.inference_options}</h5>
				</summary>

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
			</details>
		{/if}

		<!-- <hr> -->
		<div class="d-flex align-items-center p-1 pt-2">
			<!-- Left section: Error / Progress / Status -->
			<div class="flex-grow-1 me-3">
				{#if status.text}
					{#if task_running}
						<Loading message={status.text}/>
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
</style>
