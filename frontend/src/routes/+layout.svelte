<script>
	let { children } = $props();
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import '$lib/utils/default.style.css';

	//import {} from "dlonwebjs"
	import { Library } from 'dlonwebjs';
	import { onMount } from 'svelte';
	import Documentation from '$lib/Documentation.svelte';
	import { getAllSettings, saveAllSettings, getSystemSettings } from '$lib/utils/settings.js';
	import { translations, userSettings } from '$lib/utils/store.js';
	import 'typeface-roboto';

	let showInfoRow = $state(false);
	let models = $state([]);
	let loaded = $state(false)
	let userSettingsUI = $state({});
	let systemSettings = $state({})

	onMount(async () => {

		userSettingsUI = getAllSettings()
		userSettings.set(userSettingsUI)
		console.log($userSettings)
		systemSettings = getSystemSettings()
		set_theme()
		await load_language()
		models = await Library.get_model_list();
		//console.log(translations)
		import('bootstrap').then(({ Tooltip }) => {
			const tooltipTriggerList = [].slice.call(
				document.querySelectorAll('[data-bs-toggle="tooltip"]')
			);
			tooltipTriggerList.map((tooltipTriggerEl) => new Tooltip(tooltipTriggerEl));
		});
		loaded = true
	});

	let topic = $derived.by(() => {
		const path = $page.url.pathname;
		const [, firstSegment] = path.split('/');
		return firstSegment || '';
	});


	const set_theme = ()=>{
		document.documentElement.setAttribute('data-bs-theme', userSettingsUI.theme);
	}

	const load_language = async () => {
    try {
			const res = await fetch(`/locales/${userSettingsUI.language}.json`);
			//translations = await res.json()
			translations.set(await res.json());
    } catch (e) {
			await res.json()
      console.error('Failed to load language file:', e);
      translations.set({}); // fallback
    }
  };


	const toggle_theme = () => {
		userSettingsUI.theme = userSettingsUI.theme === 'light'? 'dark':'light'
		saveAllSettings(userSettingsUI)
		set_theme()
		userSettings.set(userSettingsUI)
	};

	const change_language = (new_key)=>{
		if (userSettingsUI.language != new_key){
			userSettingsUI.language = new_key
			saveAllSettings(userSettingsUI)
			load_language()
			userSettings.set(userSettingsUI)
		}
	}

</script>

{#if loaded}
<header class="navbar sticky-top bg-dark flex-md-nowrap p-0 shadow" data-bs-theme="dark">
	<a
		class="navbar-brand col-md-3 col-lg-2 me-0 px-3 fs-6 text-white"
		href="{base}/"
		style="background: #212529;">DL on the web</a
	>

	<ul class="navbar-nav flex-row d-md-none">
		<li class="nav-item text-nowrap">
			<button
				class="nav-link px-3 text-white"
				type="button"
				data-bs-toggle="offcanvas"
				data-bs-target="#sidebarMenu"
				aria-controls="sidebarMenu"
				aria-expanded="false"
				aria-label="Toggle navigation"
			>
				<svg class="bi" aria-hidden="true"><use xlink:href="#list"></use></svg>
			</button>
		</li>
	</ul>

	<!-- Right side toggle theme button -->
	<div class="ms-auto me-3 d-flex align-items-center">
		<button id="theme-toggle" class="btn btn-sm" onclick={toggle_theme}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="14"
				height="14"
				fill="currentColor"
				class="bi bi-moon"
				viewBox="0 0 16 16"
			>
				<path
					d="M6 .278a.77.77 0 0 1 .08.858 7.2 7.2 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277q.792-.001 1.533-.16a.79.79 0 0 1 .81.316.73.73 0 0 1-.031.893A8.35 8.35 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.75.75 0 0 1 6 .278M4.858 1.311A7.27 7.27 0 0 0 1.025 7.71c0 4.02 3.279 7.276 7.319 7.276a7.32 7.32 0 0 0 5.205-2.162q-.506.063-1.029.063c-4.61 0-8.343-3.714-8.343-8.29 0-1.167.242-2.278.681-3.286"
				/>
			</svg>
		</button>


		  <!-- Language dropdown using Bootstrap -->
			<div class="dropdown me-1">
				<button
					class="btn btn-sm btn-dark dropdown-toggle"
					type="button"
					id="languageDropdown"
					data-bs-toggle="dropdown"
					aria-expanded="false"
				>
					{#each systemSettings.languages as lang}
						{#if lang.key === userSettingsUI.language}
							{lang.title}
						{/if}
					{/each}
				</button>
				<ul class="dropdown-menu" aria-labelledby="languageDropdown">
					{#each systemSettings.languages as lang}
						<li>
							<a
								class="dropdown-item {lang.key === userSettingsUI.language ? 'active' : ''}"
								onclick={() => change_language(lang.key)}
							>
								{lang.title}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		{#if topic != ''}
			<button
				aria-label="Show documentation page"
				class="btn btn-sm"
				type="button"
				onclick={() => (showInfoRow = !showInfoRow)}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
					fill="currentColor"
					class="bi bi-info-lg"
					viewBox="0 0 16 16"
				>
					<path
						d="m9.708 6.075-3.024.379-.108.502.595.108c.387.093.464.232.38.619l-.975 4.577c-.255 1.183.14 1.74 1.067 1.74.72 0 1.554-.332 1.933-.789l.116-.549c-.263.232-.65.325-.905.325-.363 0-.494-.255-.402-.704zm.091-2.755a1.32 1.32 0 1 1-2.64 0 1.32 1.32 0 0 1 2.64 0"
					/>
				</svg>
			</button>
		{/if}
	</div>

</header>
<div class="container-fluid">
	<!-- Sidebar (static left) -->
	<div
		class="sidebar d-none d-md-block col-md-3 col-lg-2 p-0 bg-body-tertiary vh-100 position-fixed"
	>
		<div
			class="offcanvas-md offcanvas-end bg-body-tertiary"
			tabindex="-1"
			id="sidebarMenu"
			aria-labelledby="sidebarMenuLabel"
		>
			<div class="offcanvas-header">
				<h5 class="offcanvas-title" id="sidebarMenuLabel">DL on the web</h5>
				<button
					type="button"
					class="btn-close"
					data-bs-dismiss="offcanvas"
					data-bs-target="#sidebarMenu"
					aria-label="Close"
				></button>
			</div>
			<div class="offcanvas-body d-md-flex flex-column p-0 pt-lg-3 overflow-y-auto">
				<ul class="nav flex-column">
					 <li class="nav-item">
				<a
					class="nav-link d-flex align-items-center gap-2"
					aria-current="page"
					href="/about"
				>
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-info" viewBox="0 0 16 16">
					<path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0"/>
				</svg>
					{$translations.about}
				</a>

			</li> 
					<li class="nav-item">
						<a class="nav-link d-flex align-items-center gap-2" href="{base}/inference">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="30"
								height="30"
								fill="currentColor"
								class="bi bi-play"
								viewBox="0 0 16 16"
							>
								<path
									d="M10.804 8 5 4.633v6.734zm.792-.696a.802.802 0 0 1 0 1.392l-6.363 3.692C4.713 12.69 4 12.345 4 11.692V4.308c0-.653.713-.998 1.233-.696z"
								/>
							</svg>
							{$translations.inference}
						</a>
					</li>
					<li class="nav-item">
						<a class="nav-link d-flex align-items-center gap-2" href="{base}/training">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								fill="currentColor"
								class="bi bi-hammer"
								viewBox="0 0 16 16"
							>
								<path
									d="M9.972 2.508a.5.5 0 0 0-.16-.556l-.178-.129a5 5 0 0 0-2.076-.783C6.215.862 4.504 1.229 2.84 3.133H1.786a.5.5 0 0 0-.354.147L.146 4.567a.5.5 0 0 0 0 .706l2.571 2.579a.5.5 0 0 0 .708 0l1.286-1.29a.5.5 0 0 0 .146-.353V5.57l8.387 8.873A.5.5 0 0 0 14 14.5l1.5-1.5a.5.5 0 0 0 .017-.689l-9.129-8.63c.747-.456 1.772-.839 3.112-.839a.5.5 0 0 0 .472-.334"
								/>
							</svg>
							 {$translations.training}
						</a>
					</li>
				</ul>

				<h6
					class="sidebar-heading d-flex justify-content-between align-items-center px-3 mt-4 mb-1 text-body-secondary text-uppercase"
				>
					<span>Utilities</span>
				</h6>
				<ul class="nav flex-column mb-auto">
					<li class="nav-item">
						<a class="nav-link d-flex align-items-center gap-2" href="{base}/convert">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								fill="currentColor"
								class="bi bi-download"
								viewBox="0 0 16 16"
							>
								<path
									d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"
								/>
								<path
									d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z"
								/>
							</svg>
							{$translations.convert_model}
						</a>
					</li>

					<li class="nav-item">
						<a class="nav-link d-flex align-items-center gap-2" href="{base}/settings">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								fill="currentColor"
								class="bi bi-gear"
								viewBox="0 0 16 16"
							>
								<path
									d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492M5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0"
								/>
								<path
									d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115z"
								/>
							</svg>
							{$translations.settings}
						</a>
					</li>
				</ul>
				<h6
					class="sidebar-heading d-flex justify-content-between align-items-center px-3 mt-4 mb-1 text-body-secondary text-uppercase"
				>
					<span> {$translations.model_library}</span>
				</h6>
				<ul class="nav flex-column mb-auto">
					{#each models as mdl}
						<li class="nav-item">
							<a
								class="nav-link d-flex align-items-center gap-2"
								href={base + '/inference/' + mdl.value}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									fill="currentColor"
									class="bi bi-file-earmark-text"
									viewBox="0 0 16 16"
								>
									<path
										d="M5.5 7a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1zM5 9.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5m0 2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5"
									/>
									<path
										d="M9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.5zm0 1v2A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"
									/>
								</svg>
								{mdl.label[userSettingsUI.language]}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</div>

	<!-- Main content + info panel (flex container) -->
	<div class="offset-md-3 offset-lg-2 col-md-9 col-lg-10 d-flex p-0">
		<!-- Main content area -->
		<main class={showInfoRow ? 'col-8 px-md-4 pt-4' : 'col-12 px-md-4 pt-4'}>
			{@render children()}
		</main>

		<!-- Conditional Info Panel -->
		{#if showInfoRow}
			<div
				class="col-4 px-3 pt-4 border-start vh-100 position-fixed end-0 top-2"
				style="z-index: 1030;"
			>
				<div class="info-panel">
					<div class="d-flex justify-content-between align-items-center mb-3">
						<h5 class="m-0 text-secondary">Help</h5>
						<button
							class="btn btn-sm btn-close"
							aria-label="Close"
							onclick={() => (showInfoRow = false)}
						></button>
					</div>
					<Documentation {topic} />
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	body {
		font-family: 'Roboto', sans-serif;
	}

	.bi {
		display: inline-block;
		width: 1rem;
		height: 1rem;
	}

	/*
 * Sidebar
 */

	@media (min-width: 768px) {
		.sidebar .offcanvas-lg {
			position: -webkit-sticky;
			position: sticky;
			top: 48px;
		}
		.navbar-search {
			display: block;
		}
	}

	.sidebar .nav-link {
		font-size: 0.875rem;
		font-weight: 500;
	}

	.sidebar .nav-link.active {
		color: #2470dc;
	}

	.sidebar-heading {
		font-size: 0.75rem;
	}

	/*
 * Navbar
 */

	.navbar-brand {
		padding-top: 0.75rem;
		padding-bottom: 0.75rem;
		background-color: rgba(0, 0, 0, 0.25);
		box-shadow: inset -1px 0 0 rgba(0, 0, 0, 0.25);
	}

	.navbar .form-control {
		padding: 0.75rem 1rem;
	}

	.info-panel {
		font-size: 0.9rem;
		animation: fadeIn 0.25s ease-in-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateX(10px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}
</style>
{/if}