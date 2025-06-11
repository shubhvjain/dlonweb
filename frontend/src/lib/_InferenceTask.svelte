<script>
	import { onMount } from 'svelte';
	import { Library, InferenceTask } from 'dlonwebjs';


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
				model = await Library.get_model(name);
				model_valid = true;
				error = '';
			} else {
				model_valid = false;
				model = null;
				error = 'Select a model';
			}
		} catch (err) {
			model_valid = false;
			console.log(error);
			error = err.message;
		}
	};

	const on_load_check_model_selection = async () => {
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

	const load = async () => {
		try {
			await on_load_check_model_selection();
		} catch (err) {
			loaded = false;
			error = err.message;
		}
	};

	onMount(async () => {
		await load();
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
				let task1 = new InferenceTask(model.type, input, { libraryModelName: select_model });
				await task1.load();
				task_run_status = 'Model loaded successfully on browser. Running the model now ';
				// step 2 : run the model
				output = await task1.run();
				task_run_status = 'Model run. Output is created';
				console.log('done');

				// step 3 : show the output

				task_running = false;
				//task_run_status = 'Done';
			} else if (select_location == 'server') {
				// check if url provided
				// check if server reachable
				// send request
			}

			if (on_emit_output) {
				on_emit_output(output);
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
