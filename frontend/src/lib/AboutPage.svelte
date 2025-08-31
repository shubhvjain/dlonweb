<script>
	import { Library } from 'dlonwebjs';
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import {systemSettings,userSettings,translations} from "$lib/utils/store"
	let custom_models = $state({});
	let loaded = $state(false);
	onMount(async () => {
		let data =   await Library.load_data()
		custom_models = data["projects"]
		//console.log(custom_models)
		loaded = true;
	});

</script>




<!-- Hero Section -->
<!-- <header class="bg-primary text-white text-center py-5">
	<div class="container">
		<h1 class="display-4 fw-bold">Welcome to Federated Learning</h1>
		<p class="lead">Privacy-Preserving Collaborative AI Training</p>
		<a href="#about" class="btn btn-light btn-lg mt-3">Learn More</a>
	</div>
</header> -->

<!-- About Section -->
<!-- <section id="about" class="py-5">
	<div class="container">
		<div class="row align-items-center">
			<div class="col-md-6 mb-4">
				<img src="https://via.placeholder.com/500x300" alt="Federated Learning Illustration" class="img-fluid rounded shadow">
			</div>
			<div class="col-md-6">
				<h2 class="fw-bold">What is Federated Learning?</h2>
				<p class="text-muted">
					Federated Learning allows multiple devices or organizations to collaboratively train a machine learning model without sharing raw data. 
					Instead, only model updates are exchanged, ensuring data privacy and security.
				</p>
				<ul class="list-group list-group-flush">
					<li class="list-group-item">🔒 Data privacy preserved</li>
					<li class="list-group-item">⚡ Efficient model training</li>
					<li class="list-group-item">🌍 Collaboration across devices/organizations</li>
				</ul>
			</div>
		</div>
	</div>
</section> -->






<div class="row justify-content-md-center">
	<div class="col-lg-9">
		<nav class="navbar navbar-expand-lg">
			<div class="container">
				
			
				<div class="collapse navbar-collapse" id="navbarNav">
					<ul class="navbar-nav ms-auto">
						
						<li class="nav-item"><a class="nav-link" href="#about">About</a></li>
						<li class="nav-item"><a class="nav-link" href="#library">Library</a></li>
						<li class="nav-item"><a class="nav-link" href="#contact">Contact</a></li>
					</ul>
				</div>
			</div>
		</nav>
		<div class="p-4 py-5 p-md-5 mb-4 rounded text-body-emphasis bg-body-tertiary">
			<div class="col-lg-12 lg-auto px-0">
			
				<h1 class="display-6 fst-italic1">Federated learning right in your browser</h1>
				<p class="lead my-3">
					Intro here 
				</p>
				<a class="btn btn-outline-secondary" type="button"  href="#about">Learn more</a> 

        <a class="btn btn-outline-secondary" type="button"  href="{base}/inference">Run prediction</a> 
				{#if $systemSettings.sections.training}
					<a class="btn btn-outline-secondary" type="button"  href="{base}/training">Train a model</a> 	
				{/if}
				


			
			</div>
		</div>

	

		<div id="about" class="row p-2 mb-5 mt-5">
			<div class="col-md-7">
				<h3><span class="text-muted">What is federated learning ?</span></h3>
				<p class="lead">Donec ullamcorper nulla non metus auctor fringilla. Vestibulum id ligula porta felis euismod semper. Praesent commodo cursus magna, vel scelerisque nisl consectetur. Fusce dapibus, tellus ac cursus commodo.</p>
			</div>
			<div class="col-md-5">
				<img class=" img-fluid mx-auto" data-src="holder.js/500x500/auto" alt="500x500" style="width: 500px; height: 500px;" src="data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22500%22%20height%3D%22500%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20500%20500%22%20preserveAspectRatio%3D%22none%22%3E%3Cdefs%3E%3Cstyle%20type%3D%22text%2Fcss%22%3E%23holder_198e870756e%20text%20%7B%20fill%3A%23AAAAAA%3Bfont-weight%3Abold%3Bfont-family%3AArial%2C%20Helvetica%2C%20Open%20Sans%2C%20sans-serif%2C%20monospace%3Bfont-size%3A25pt%20%7D%20%3C%2Fstyle%3E%3C%2Fdefs%3E%3Cg%20id%3D%22holder_198e870756e%22%3E%3Crect%20width%3D%22500%22%20height%3D%22500%22%20fill%3D%22%23EEEEEE%22%3E%3C%2Frect%3E%3Cg%3E%3Ctext%20x%3D%22183.13333129882812%22%20y%3D%22261.7%22%3E500x500%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E" data-holder-rendered="true">
			</div>
		</div>
	

		<div class="row mt-2 p-2">
			<div class="col-md-7 order-md-2">
				<h2 class=""><span class="text-muted">Introducing {$systemSettings.meta.name}</span></h2>
				<p class="lead">Donec ullamcorper nulla non metus auctor fringilla. Vestibulum id ligula porta felis euismod semper. Praesent commodo cursus magna, vel scelerisque nisl consectetur. Fusce dapibus, tellus ac cursus commodo.</p>
			</div>
			<div class="col-md-5 order-md-1">
				<img class="featurette-image img-fluid mx-auto" data-src="holder.js/500x500/auto" alt="500x500" style="width: 500px; height: 500px;" src="data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22500%22%20height%3D%22500%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20500%20500%22%20preserveAspectRatio%3D%22none%22%3E%3Cdefs%3E%3Cstyle%20type%3D%22text%2Fcss%22%3E%23holder_198e870756f%20text%20%7B%20fill%3A%23AAAAAA%3Bfont-weight%3Abold%3Bfont-family%3AArial%2C%20Helvetica%2C%20Open%20Sans%2C%20sans-serif%2C%20monospace%3Bfont-size%3A25pt%20%7D%20%3C%2Fstyle%3E%3C%2Fdefs%3E%3Cg%20id%3D%22holder_198e870756f%22%3E%3Crect%20width%3D%22500%22%20height%3D%22500%22%20fill%3D%22%23EEEEEE%22%3E%3C%2Frect%3E%3Cg%3E%3Ctext%20x%3D%22183.13333129882812%22%20y%3D%22261.7%22%3E500x500%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E" data-holder-rendered="true">
			</div>
		</div>

		<div class="container px-2 py-2" id="features-grid">
			<h3 class="pb-2 ">Features</h3>
			<div class="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-4 py-4 border-bottom1">
				<div class="col d-flex align-items-start">
					<svg
						class="bi text-body-secondary flex-shrink-0 me-3 bi-1-circle-fill"
						xmlns="http://www.w3.org/2000/svg"
						width="30"
						height="30"
						fill="currentColor"
						viewBox="0 0 16 16"
					>
						<path
							fill-rule="evenodd"
							d="M8 0c-.69 0-1.843.265-2.928.56-1.11.3-2.229.655-2.887.87a1.54 1.54 0 0 0-1.044 1.262c-.596 4.477.787 7.795 2.465 9.99a11.8 11.8 0 0 0 2.517 2.453c.386.273.744.482 1.048.625.28.132.581.24.829.24s.548-.108.829-.24a7 7 0 0 0 1.048-.625 11.8 11.8 0 0 0 2.517-2.453c1.678-2.195 3.061-5.513 2.465-9.99a1.54 1.54 0 0 0-1.044-1.263 63 63 0 0 0-2.887-.87C9.843.266 8.69 0 8 0m0 5a1.5 1.5 0 0 1 .5 2.915l.385 1.99a.5.5 0 0 1-.491.595h-.788a.5.5 0 0 1-.49-.595l.384-1.99A1.5 1.5 0 0 1 8 5"
						/>
					</svg>
					<div>
						<h3 class="fw-bold mb-0 fs-4 text-body-emphasis">Privacy aware</h3>
						<p>Your data does not leave the browser</p>
					</div>
				</div>
				<div class="col d-flex align-items-start">
					<svg
						class="bi text-body-secondary flex-shrink-0 me-3 bi-1-circle-fill"
						xmlns="http://www.w3.org/2000/svg"
						width="30"
						height="30"
						fill="currentColor"
						viewBox="0 0 16 16"
					>
						<path
							d="M10.706 3.294A12.6 12.6 0 0 0 8 3C5.259 3 2.723 3.882.663 5.379a.485.485 0 0 0-.048.736.52.52 0 0 0 .668.05A11.45 11.45 0 0 1 8 4q.946 0 1.852.148zM8 6c-1.905 0-3.68.56-5.166 1.526a.48.48 0 0 0-.063.745.525.525 0 0 0 .652.065 8.45 8.45 0 0 1 3.51-1.27zm2.596 1.404.785-.785q.947.362 1.785.907a.482.482 0 0 1 .063.745.525.525 0 0 1-.652.065 8.5 8.5 0 0 0-1.98-.932zM8 10l.933-.933a6.5 6.5 0 0 1 2.013.637c.285.145.326.524.1.75l-.015.015a.53.53 0 0 1-.611.09A5.5 5.5 0 0 0 8 10m4.905-4.905.747-.747q.886.451 1.685 1.03a.485.485 0 0 1 .047.737.52.52 0 0 1-.668.05 11.5 11.5 0 0 0-1.811-1.07M9.02 11.78c.238.14.236.464.04.66l-.707.706a.5.5 0 0 1-.707 0l-.707-.707c-.195-.195-.197-.518.04-.66A2 2 0 0 1 8 11.5c.374 0 .723.102 1.021.28zm4.355-9.905a.53.53 0 0 1 .75.75l-10.75 10.75a.53.53 0 0 1-.75-.75z"
						/>
					</svg>
					<div>
						<h3 class="fw-bold mb-0 fs-4 text-body-emphasis">Local first</h3>
						<p>All main functionalities can run without the internet</p>
					</div>
				</div>
				<div class="col d-flex align-items-start">
					<svg
						class="bi text-body-secondary flex-shrink-0 me-3 bi-1-circle-fill"
						xmlns="http://www.w3.org/2000/svg"
						width="30"
						height="30"
						fill="currentColor"
						viewBox="0 0 16 16"
					>
						<path
							d="M1 11a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1zm5-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1zm5-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1z"
						/>
					</svg>
					<div>
						<h3 class="fw-bold mb-0 fs-4 text-body-emphasis">Effective</h3>
						<p>Paragraph of text beneath the heading to explain the heading.</p>
					</div>
				</div>
				<div class="col d-flex align-items-start">
					<svg
						class="bi text-body-secondary flex-shrink-0 me-3 bi-1-circle-fill"
						xmlns="http://www.w3.org/2000/svg"
						width="30"
						height="30"
						fill="currentColor"
						viewBox="0 0 16 16"
					>
						<path
							d="M2.5 3.5a.5.5 0 0 1 0-1h11a.5.5 0 0 1 0 1zm2-2a.5.5 0 0 1 0-1h7a.5.5 0 0 1 0 1zM0 13a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 16 13V6a1.5 1.5 0 0 0-1.5-1.5h-13A1.5 1.5 0 0 0 0 6zm1.5.5A.5.5 0 0 1 1 13V6a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5z"
						/>
					</svg>
					<div>
						<h3 class="fw-bold mb-0 fs-4 text-body-emphasis">Model library</h3>
						<p>Paragraph of text beneath the heading to explain the heading.</p>
					</div>
				</div>
			</div>
		</div>

    <!-- <div class="container px-2 py-2" id="feature1-grid">
			<h3 class="pb-2 border-bot1tom">Effective</h3>
			<div class="col-lg-12 mx-auto">
				<p class="lead mb-4">
					Quickly design and customize responsive mobile-first sites with Bootstrap, the world’s
					most popular front-end open source toolkit, featuring Sass variables and mixins,
					responsive grid system, extensive prebuilt components, and powerful JavaScript plugins.
				</p>
			
			</div>
      <div class="px-4 pt-5 my-5 text-center border-bottom">
          <div class="container px-5">
            <img
              src="/images/image1.png"
              class="img-fluid border rounded-3 shadow-lg mb-4"
              alt="Example image"
              width="700"
              height="600"
              loading="lazy"
            />
           <p>Caption here</p>
          </div>
      </div>
		</div> -->




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
