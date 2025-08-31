<script>
	let { modelName } = $props();
	import { onMount } from 'svelte';
	import Input from './utils/_Input.svelte';
	import { Library } from 'dlonwebjs';
	import InferenceTask from './utils/_InferenceTask.svelte';
	import Output from './utils/_Output.svelte';
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
