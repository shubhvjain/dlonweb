<script>
	import { onMount, onDestroy } from 'svelte';

	import { Library,Data, InferenceTask } from 'dlonwebjs';
	import {adaptor} from "$lib/utils/adapter.browser"

	import { translations, userSettings } from '$lib/utils/store.js';
	import Input from './_Input.svelte';
	import { InferencePipeline } from '$lib/utils/inferencePipeline.js';
	import { filesStore } from '$lib/utils/filesStorage';
	import { get } from 'svelte/store';

	/**
	 * The Component inputs  includes :
	 * - `component_valid` : a bindable flag that indicates if the model is valid or not
	 * - `model_name` : to select a model name by default
	 * - `emit_output` : this is a method that other components can use to get the output of the model
	 */
	let { component_valid = $bindable(false), model_name, on_emit_output } = $props();

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

	let dev_mode = $state(true)

	// To manage input
	let input_valid = $state(false);
	let input_data = $state([]);
	let input_options = $state({});

	// To manage model
	let selected_model = $state(''); // name of the selected model
	let custom_model_used = $state(false);
	let model_details = $state({ title: '', description: '' });
	let modelList = $state([]); // list of all models in the library

	// To manage model running
	let worker = $state();
	let progress = $state({ current: 0, total: 0, percentage: 0 });
	let select_location = $state('browser');
	let task_running = $state(false);
	let task_run_status = $state('');
	let pipeline = $state();

	// output of the model
	let output = $state();

	onMount(async () => {
		await load_page();
	});

	onDestroy(() => {
		if (pipeline) {
			pipeline.terminate();
		}
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
			input_data = $state.snapshot(filesStore);
			//console.log(input_data);
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
			er.push('No model selected for inference task');
			//component_valid = false;
		}
		if (!input_valid) {
			er.push('Input is not valid');
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

	/**
	 * To run the inference pipeline
	 */
	const inference_pipeline = async () => {
		try {
			if (!selected_model || !input_valid) {
				throw new Error('Model or input invalid')
			}
			task_running = true;
			progress = { current: 0, total: 0, percentage: 0 };
			set_success("Initializing")
			
			// Create worker if not already exists
			if (!worker) {
				worker = new Worker(new URL('$lib/utils/inference.worker.js', import.meta.url), {
					type: 'module'
				});
			}


			// Create or recreate pipeline
			pipeline = new InferencePipeline()

			//select_location, 'web_worker', worker);

			//set_success("Checking model")
			//await pipeline.load_input(input_data,input_options)

			
			// Progress callback
			const onProgress = (p) => {
				progress = {
					current: p.current,
					total: p.total,
					percentage: p.total > 0 ? (p.current / p.total) * 100 : 0
				};
				set_success(`Processing ${p.current}/${p.total}`);
			};



			//set_success('Loading Input')
			// Run inference
			const filesArray = Array.from(get(filesStore));
			if (filesArray.length == 0) {
				throw new Error('No input files available');
			}
			
			//await pipeline.load_input(input_data,input_options)
			//set_success("Files loaded successfully")


			/*
    inputFiles = [],
		modelDetails = { name: '', model: null },
		runOptions = { location: 'browser', mode: 'web_worker', worker: null },
		onProgress = () => {}
    */

			output = await pipeline.run(
				filesArray,
				sanitizeJSON({ name: selected_model }),
				{ location: 'browser', mode: 'main_thread' },
				onProgress
			);

			task_run_status = 'Inference completed!';
			console.log('Pipeline output:', output);
			task_running = false;
		} catch (err) {
			task_running = false;
			set_error(`Pipeline failed: ${err.message}`)

			console.error('Pipeline error:', err);
			// error = `Pipeline failed: ${err.message}`;
		} 
		// finally {
			
		// 	// Reset progress after a delay to show completion
		// 	setTimeout(() => {
		// 		progress = { current: 0, total: 0, percentage: 0 };
		// 	}, 2000);
		// }
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


  const simple_inference_run = async () => {
    // 1. Create worker
    const worker = new Worker(
      new URL('$lib/utils/inference.worker.js', import.meta.url),
      { type: 'module' }
    );


		const filesArray = Array.from(get(filesStore));
			if (filesArray.length == 0) {
				throw new Error('No input files available');
			}
			let testdata = new Data(adaptor,filesArray, sanitizeJSON(input_options))
			await testdata.load()
			console.log("data loaded")
			console.log(testdata)


		
			 // e.g., file input element
    //let data = new Data(adaptor,filesArray,input_options)
    //await data.load();

    // 3. Create InferenceTask using worker mode
    const task = new InferenceTask({
      env: adaptor,
      model_name: selected_model, // example
      run_mode: 'web_worker',
      worker
    });

    // 4. Load data into task (main thread, tensors created in main thread)
    await task.load_data(testdata);

    // 5. Run inference
    task.run_model(
      (p) => {
        // progress = p; // update Svelte reactive variable
				console.log(p)
      }
    ).then((outputMap) => {
			console.log(outputMap)
      //results = outputMap;
      console.log('Inference complete', outputMap);
      worker.terminate(); // cleanup worker
    }).catch((err) => {
			console.log(err)
      console.error('Inference error', err);
      worker.terminate();
    });
  };


	const test_tensor_generation = async ()=>{
		try {
			console.log("testing data")
			const filesArray = Array.from(get(filesStore));
			if (filesArray.length == 0) {
				throw new Error('No input files available');
			}
			let testdata = new Data(adaptor,filesArray,input_options)
			await testdata.load()
			console.log("data loaded")
			console.log(testdata)

			let model_details = await Library.get_model_options(selected_model)			
			console.log(model_details)

			await testdata.create_tensors(selected_model,model_details)
			console.log(testdata)

		} catch (error) {
			console.log(error)
		}
	}
</script>

<div class="p-1 mb-2 pt-2">
	<!-- {#if workerRunning}<p>Progress: {progress.percentage.toFixed(1)}%</p>{/if} -->
	<h4 class="mb-2">1. {$translations.choose_model}</h4>

	<select
		class="form-select form-select-lg mb-2"
		aria-label="select model"
		onchange={() => select_model(selected_model)}
		bind:value={selected_model}
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

	{#if selected_model}
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
		{#if status.text}
			<div class="text-{status.type} mb-2">{status.text}</div>
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

{#if dev_mode}
	<div>
		<button class="btn btn-link" onclick={test_tensor_generation}> Test tensor generation </button>

		

		<button class="btn btn-link" onclick={simple_inference_run}> run simple </button>

	</div>
{/if}


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
