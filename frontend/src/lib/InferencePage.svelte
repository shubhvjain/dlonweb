<script>
	let { modelName } = $props();
	import { onMount } from 'svelte';
	import Input from './_Input.svelte';
	import { Library } from 'dlonwebjs';
	import InferenceTask from './_InferenceTask.svelte';
	import Output from './_Output.svelte';

	let modelList = $state([]);
	let input = $state();
	let model = $state();
	let outputs = $state([]);

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

	const appendOutputs = (op)=>{
		outputs.push(op)
	}
</script>

{#if status.loaded}
	<br /><br /><br /> 
	<div class="row justify-content-md-center mt-5">
		<div class="col-lg-6">
			<div class="card text-center border  {status.input?" border-success-subtle ":" border-danger-subtle  "} " >
				<div class="card-body">
					<Input bind:data_valid={status.input} bind:data={input}/>
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
					<InferenceTask bind:model_valid={status.model} bind:model={model} model_name={modelName} input_valid={status.input} bind:input={input} on_emit_output={appendOutputs} />
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
			{#if outputs.length>0}
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
			{/if}
			<div class="row">
				{#each outputs as out }
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
