<script>
	let { modelName } = $props();
	import { onMount } from 'svelte';
	import Input from './_Input.svelte';
	import { Library } from 'dlonwebjs';
	import InferenceTask from './_InferenceTask.svelte';
	import Output from './_Output.svelte';
	import { translations } from '$lib/utils/store.js';

	import { beforeNavigate } from '$app/navigation';

	let page_processing = $state(false);

	beforeNavigate((nav) => {
		if (page_processing) {
			// Cancel the navigation
			nav.cancel();
			alert('Processing is still running. Please wait before leaving or cancel the current task.');
		}
	});

	let modelList = $state([]);
	let input = $state([]);
	let model = $state();
	let output_stack = $state([]);
	let outputs = $state([]);

	let status = $state({
		modelSelected: false,
		input: false,
		model: false,
		output: false,
		loaded: false,
		error: ''
	});

	onMount(async () => {
		output_stack = [];
		status.loaded = true;

		
	});

	const appendOutputs = (op) => {
		if (output_stack.length >= 50) {
			output_stack.shift(); // remove the oldest item if full
		}
		output_stack.push(op);
	};
</script>

{#if status.loaded}
	<div class="row justify-content-md-center mt-4">
		<div class="col-lg-8">

			<InferenceTask
			bind:model_valid={status.model}
			bind:task_running={page_processing}
			model_name={modelName}
			emit_output={appendOutputs}
		/>


		
			<!-- <div class="card text-center border  {status.input?" border-success-subtle ":" border-danger-subtle  "} " >
				<div class="card-body">
					<Input bind:data_valid={status.input} bind:data={input}/>
				</div>
			</div> -->

			<!-- <div class="card text-center">
				<div class="card-body">
					<h6 class="card-title border-bottom">Model</h6>
				
					{#if status.modelSelected }
						{ JSON.stringify(model)}
					{:else}
						model can be selected
					{/if}
				</div>
			</div> -->
			{#if outputs.length > 0}
				<div class="text-center">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="45"
						height="45"
						fill="currentColor"
						class="bi bi-arrow-down"
						viewBox="0 0 16 16"
					>
						<path
							fill-rule="evenodd"
							d="M8 1a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L7.5 13.293V1.5A.5.5 0 0 1 8 1"
						/>
					</svg>
				</div>
			{/if}
			<div class="row">
				{#each outputs as out}
					<div class="card text-center col-lg-12">
						<div class="card-body">
							<h6 class="card-title border-bottom">Output</h6>
							<Output output={out} />
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>

		{#each output_stack as out}
		<div class="row justify-content-md-center mt-4">
			<div class="col-lg-8">
				<Output output={out} />
			</div>
			
		</div>
	{/each}
{:else if status.error}
	<div class="alert alert-danger" role="alert">
		{status.error}
	</div>
{/if}

<style>
	.accordion-button:not(.collapsed) {
		color: var(--bs-accordion-active-color);
		background-color: var(--bs-accordion-btn-bg);
		box-shadow: inset 0 calc(-1 * var(--bs-accordion-border-width)) 0
			var(--bs-accordion-border-color);
	}
</style>
