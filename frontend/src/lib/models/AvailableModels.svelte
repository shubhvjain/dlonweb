<script>
	import * as models from '$lib/dlonweb/models';
	import { onMount } from 'svelte';
	let list = $state([]);
	let details = $state({});
	onMount(() => {
		console.log(12);
		list, (details = models.get_models_list());
	});
</script>

<div class="p-2 p-md-4 mb-4 rounded border">
	<div class="col-lg-12 px-0">
		<h3 class="border-bottom">List of models available</h3>
		The app ships with various pre trained models for multiple use cases
    
		{#each Object.keys(models.custom_models) as proj}
			<div class="card mt-3 pt-1">
				<div class="card-body">
					<h4 class="card-title">{models.custom_models[proj].title}</h4>
					<p class="card-text fs-5">
						{models.custom_models[proj].description} <br />
					</p>
					<ul>
						<li><b>Source: </b> {models.custom_models[proj].source}</li>
						<li>
							<b>Website: </b>
							<a target="_blank" href={models.custom_models[proj].website}
								>{models.custom_models[proj].website}</a
							>
						</li>
						<li><b>Input: </b> {models.custom_models[proj].model_input}</li>
						<li><b>Output: </b>{models.custom_models[proj].model_output}</li>
					</ul>
				</div>
				<ul class="list-group list-group-flush">
					{#each Object.keys(models.custom_models[proj]['models']) as model}
						<li class="list-group-item">
							<div class="d-flex">
								<div class="p-2"><code>{proj + '-' + model}</code> :</div>
								<div class="p-2 flex-grow-1">
									{models.custom_models[proj]['models'][model].title}
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
