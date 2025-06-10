<script>
	let { modelName } = $props();
	import { onMount } from 'svelte';
	import Input from './_Input.svelte';
	import { Library } from 'dlonwebjs';
	import InferenceTask from './_InferenceTask.svelte';

	let modelList = $state([]);
	let input = $state();
	let model = $state();
	let output = $state();

	let status = $state({
		modelSelected: false,
		input : false,
		model: false,
		output : false,	
		loaded:false,
		error:"",
	})

	onMount(async () => {
			status.loaded = true
	});
</script>

{#if status.loaded}
	<br /><br /><br /><br />
	<div class="row justify-content-md-center mt-5">
		<div class="col-lg-6">
			<div class="card text-center border  {status.input?" border-success-subtle ":" border-danger-subtle  "} " >
				<div class="card-body">
					<Input bind:input_valid={status.input} bind:input={input}/>
				</div>
			</div>
			<div class="text-center">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="30"
					height="30"
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
			<div class="card text-center border  {status.model?" border-success-subtle ":" border-danger-subtle  "} " >
				<div class="card-body">
					<InferenceTask bind:model_valid={status.model} bind:model={model} model_name={modelName} input_valid={status.input}/>
				</div>
			</div>
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
			<div class="text-center">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="30"
					height="30"
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
			<div class="card text-center">
				<div class="card-body">
					<h6 class="card-title border-bottom">Output</h6>
					<p class="card-text">
						Some quick example text to build on the card title and make up the bulk of the card’s
						content.
					</p>
					<a href="#" class="btn btn-primary">Go somewhere</a>
				</div>
			</div>
		</div>
	</div>
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
