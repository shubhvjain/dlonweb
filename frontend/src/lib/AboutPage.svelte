<script>
	import { Library } from 'dlonwebjs';
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import {systemSettings,userSettings,translations} from "$lib/utils/store"
	let custom_models = $state({});
	let loaded = $state(false);


  let features = [
    {
      title: "Model Library",
      text: "A collection of machine learning models that can be integrated and run within a single interface."
    },
    {
      title: "Multi-Modal Inference",
      text: "Run inference on images, videos, and text for flexible and heterogeneous input types."
    },
    {
      title: "Bulk Data Processing",
      text: "Upload multiple inputs and download results in bulk, with zipped outputs for convenience."
    },
    {
      title: "Offline-First Design",
      text: "All computations stay local in your browser, ensuring privacy and reliability."
    },
    {
      title: "Multilingual Interface",
      text: "Supports multiple languages (currently English and German) for broader accessibility."
    },
    {
      title: "Open-Source Framework",
      text: "Transparent, reproducible, and community-driven development model."
    },
    {
      title: "Intuitive Interface",
      text: "A user-friendly design optimized for productivity, with help sections on every page."
    },
    {
      title: "Multiple Inference Tasks",
      text: "Supports diverse tasks such as object detection, segmentation, and more."
    }
  ];


	onMount(async () => {
		let data =   await Library.load_data()
		custom_models = data["projects"]
		//console.log(custom_models)
		loaded = true;
	});

</script>
<div class="container-fluid">
<div class="row justify-content-md-center">
	<div class="col-lg-9">
		<nav class="navbar navbar-expand-lg">
			<div class="container">
				
			
				<div class="collapse navbar-collapse" id="navbarNav">
					<ul class="navbar-nav ms-auto">
						
						<li class="nav-item"><a class="nav-link" href="#about">About</a></li>
						<li class="nav-item"><a class="nav-link" href="#features">Features</a></li>
						<li class="nav-item"><a class="nav-link" href="#contact">Contact</a></li>
					</ul>
				</div>
			</div>
		</nav>
		<div class="p-4 py-5 p-md-5 mb-4 rounded text-body-emphasis bg-body-tertiary">
			<div class="col-lg-12 lg-auto px-0">
			
				<h1 class="display-6 fst-italic1">Deep learning, right in your browser</h1>
				<p class="lead my-3">
					Open, privacy-aware, and accessible AI for everyone.
				</p>
				<!-- <a class="btn btn-outline-secondary" type="button"  href="#about">Learn more</a>  -->
        <a class="btn btn-outline-secondary" type="button"  href="{base}/inference">Run prediction</a> 
				<a class="btn btn-outline-secondary" type="button"  href="{base}/library"> Browse model library</a> 
				{#if $systemSettings.sections.training}
					<a class="btn btn-outline-secondary" type="button"  href="{base}/training">Train a model</a> 	
				{/if}			
			</div>
		</div>
		<div class="row mt-2 p-2">
			<div class="col-md-5 order-md-2">
				<h2 class=""><span class="text-muted">Introducing {$systemSettings.meta.name}</span></h2>
				<p class="lead"> {$systemSettings.meta.name} is a browser-based application that allows anyone—whether a clinician, researcher, or student—to run deep learning models without specialized technical skills. 
					Built with an offline-first design, it works entirely within your browser, ensuring security and reliability. 
					With its intuitive interface and extensive model library, {$systemSettings.meta.name} lowers the barrier to adopting AI in real-world workflows.</p>
			</div>
			<div class="col-md-7 or1der-md-1">
				<img class=" img-fluid mx-auto" src="images/intro.svg"   alt="DLonWeb usecases">
			</div>
		</div>

		<div id="about" class="row p-2 mb-5 mt-5">
			<div class="col-md-5">
				<h3><span class="text-muted">What is federated learning ?</span></h3>
				<p class="lead">Federated Learning (FL) is a privacy preserving approach to Artificial Intelligence. Instead of sending sensitive data to a central server, models are trained/updates/run on local device. This ensures personal or clinical information stays secure while still enabling of AI  </p> 

			</div>
			<div class="col-md-7">
				<img class=" img-fluid mx-auto" src="images/fedlearning.svg" alt="fed learning">
			</div>
		</div>
	

	

		<div class="container px-3 py-5" id="features">
			<h3 class="pb-3 text-center">Features</h3>
			<div class="row row-cols-1 row-cols-sm-2 row-cols-md-3 g-4">
				{#each features as feature}
					<div class="col">
						<div class="p-2">
							<h4 class="mb-2 mt-2">{feature.title}</h4>
							<p class="text-muted lead mb-0">{feature.text}</p>
						</div>
					</div>
				{/each}
			</div>
		</div>
		
		


<!-- Contact Section -->
<section id="contact" class=" py-4">
	<div class="container text-center">
		<h3>Get in Touch</h3>
		<p class="text-muted">Have questions or want to contribute? Reach out to us!</p>
		<a href="mailto:{$systemSettings.contact.email}" class="btn btn-primary">Contact Us</a>
	</div>
</section>

		<!-- Footer -->
		<footer class="text-center py-3">
			<p class="mb-0">&copy; 2025</p>
		</footer>
	</div>
</div>
</div>


<!-- <style>
	* {
  outline: 1px solid red;
}
</style> -->