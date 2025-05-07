<script>
	import { onMount } from 'svelte';
	import * as GeoTIFF from 'geotiff';

	let file = $state();
	let canvasEl = $state();
	let tiff = $state();
	let currentImage = $state();
	let imageCount = $state(0);
	let currentPage = $state(0);

	const handleFileChange = async (event) => {
		const uploadedFile = event.target.files[0];
		if (!uploadedFile) return;

		const buffer = await uploadedFile.arrayBuffer();
		tiff = await GeoTIFF.fromArrayBuffer(buffer);
		console.log(tiff);
		imageCount = await tiff.getImageCount();
		currentPage = 0;

		await loadImage(currentPage);
	};

	const loadImage = async (index) => {
		currentImage = await tiff.getImage(index);
		console.log(currentImage);
		await renderImage();
	};

	const renderImage = async () => {
		const samplesPerPixel = currentImage.getSamplesPerPixel();
		const bitsPerSample = currentImage.getBitsPerSample();
		console.log(samplesPerPixel, bitsPerSample);
		const maxVal = Math.pow(2, bitsPerSample) - 1;
		const data = await currentImage.readRasters();
		console.log(data);
		const canvas = document.getElementById('image_preview');
		const plot = new window.plotty.plot({
			canvas,
			data: data[0],
			width: currentImage.getWidth(),
			height: currentImage.getHeight(),
			domain: [0, maxVal],
			colorScale: 'greys'
		});
		plot.render();

		let width = currentImage.getWidth();
		let height = currentImage.getHeight();
		let raster = data[0];
		const canvas1 = document.getElementById('canvas2');
		canvas1.width = width;
		canvas1.height = height;
		const ctx = canvas1.getContext('2d');
		const imageData = ctx.createImageData(width, height);

		const normalize = (val) => Math.min(255, Math.round(val / 256)); // for 16-bit

		for (let i = 0; i < width * height; i++) {
			let r = 0,
				g = 0,
				b = 0;
			if (samplesPerPixel >= 3) {
				r = normalize(raster[i * samplesPerPixel]);
				g = normalize(raster[i * samplesPerPixel + 1]);
				b = normalize(raster[i * samplesPerPixel + 2]);
			} else {
				r = g = b = normalize(raster[i]); // grayscale fallback
			}

			imageData.data[i * 4 + 0] = r;
			imageData.data[i * 4 + 1] = g;
			imageData.data[i * 4 + 2] = b;
			imageData.data[i * 4 + 3] = 255; // full opacity
		}

		ctx.putImageData(imageData, 0, 0);
	};

	const handleSliderChange = async (e) => {
		currentPage = +e.target.value;
		console.log(currentPage);
		await loadImage(currentPage);
	};
</script>

<div class="container py-4">

	<div class="mb-3">
		<label class="form-label">Upload a TIFF File</label>
		<input class="form-control" type="file" accept=".tif,.tiff" onchange={handleFileChange} />
	</div>

	{#if imageCount > 1}
		<div class="mb-3">
			<label class="form-label">Page: {currentPage + 1} / {imageCount}</label>
			<input
				type="range"
				min="0"
				max={imageCount - 1}
				bind:value={currentPage}
				class="form-range"
				oninput={handleSliderChange}
			/>
		</div>
	{/if}
	<div style="overflow-x: scroll;">
		<canvas bind:this={canvasEl} id="image_preview" class="border shadow-sm"></canvas>
		<!-- <canvas id="canvas2" class="border shadow-sm"></canvas> -->
	</div>
	
</div>