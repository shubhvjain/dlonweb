<script>
	import * as models from '$lib/dlonweb/models';
	import { onMount } from 'svelte';
	let custom_models = $state({});
	let loaded = $state(false);
	onMount(async () => {
		custom_models = await models.get_model_data();
		loaded = true;
	});
</script>
{#if loaded}
	<div class="p-2 p-md-4 mb-4 rounded border">
		<div class="col-lg-12 px-0">
			<h3 class="border-bottom">List of models available</h3>
			The app ships with various pre trained models for multiple use cases

			{#each Object.keys(custom_models) as proj}
				<div class="card mt-3 pt-1">
					<div class="card-body">
						<h4 class="card-title">{custom_models[proj].title}</h4>
						<p class="card-text fs-5">
							{custom_models[proj].description} <br />
						</p>
						<ul>
							<li><b>Source: </b> {custom_models[proj].source}</li>
							<li>
								<b>Website: </b>
								<a target="_blank" href={custom_models[proj].website}
									>{custom_models[proj].website}</a
								>
							</li>
							<li><b>Input: </b> {custom_models[proj].model_input}</li>
							<li><b>Output: </b>{custom_models[proj].model_output}</li>
						</ul>
					</div>
					<ul class="list-group list-group-flush">
						{#each Object.keys(custom_models[proj]['models']) as model}
							<li class="list-group-item">
								<div class="d-flex">
									<div class="p-2"><code>{proj + '-' + model}</code> :</div>
									<div class="p-2 flex-grow-1">
										{custom_models[proj]['models'][model].title}
									</div>
									<div class="p-2"><button class="btn btn-link">Use</button></div>
								</div>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
	</div>
{/if}
