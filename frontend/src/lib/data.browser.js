import * as tf from '@tensorflow/tfjs';

export const browserOptions = {
	environment: 'browser',
	env: {
		tf,

		getInputType(input) {
			if (typeof tf !== 'undefined' && input instanceof tf.Tensor) {
				return { kind: 'tensor', structure: 'simple' };
			}

			if (Array.isArray(input) && input[0] instanceof tf.Tensor) {
				return { kind: 'tensor', structure: 'complex' };
			}

			// File or Blob
			if (typeof File !== 'undefined' && input instanceof File) {
				const ext = input.name.split('.').pop().toLowerCase();
				const type = input.type || '';

				if (type.startsWith('image/') && !['tiff', 'tif'].includes(ext)) {
					return { kind: 'image', structure: 'simple' };
				} else if (type.startsWith('video/')) {
					return { kind: 'video', structure: 'complex' };
				} else if (['tiff', 'tif'].includes(ext)) {
					return { kind: 'tiff', structure: 'complex' };
				} else if (type.startsWith('text/') || ext === 'txt') {
					return { kind: 'text', structure: 'simple' };
				}
			}

			return null;
		},

		//// Human ====> Data
		/**
		 * @param {File} file
		 * @param {Object} options - { targetWidth, targetHeight, normalize }
		 * @returns {Promise<tf.Tensor>}
		 */
		decodeImageToTensor: decodeImageToTensorBrowser,

		// /**
		//  * @param {File} file
		//  * @param {Object} options
		//  * @returns {Promise<tf.Tensor[]>}
		//  */
		// async decodeVideoToTensors(file, options = {}) {
		//   // Not implemented yet
		//   throw new Error("decodeVideoToTensors not implemented in browser env");
		// },

		async decodeVideoToImages(file, options) {
			if (!options.fps) {
				throw new Error('fps required');
			}

			return new Promise((resolve, reject) => {
				const video = document.createElement('video');
				video.src = URL.createObjectURL(file);
				video.crossOrigin = 'anonymous';
				video.preload = 'auto';
				video.muted = true;

				video.onloadedmetadata = async () => {
					const duration = video.duration;
					const canvas = document.createElement('canvas');
					const ctx = canvas.getContext('2d');

					canvas.width = video.videoWidth;
					canvas.height = video.videoHeight;

					const results = [];

					const totalFrames = Math.floor(duration * options.fps);
					for (let i = 0; i < totalFrames; i++) {
						const time = i / options.fps;
						video.currentTime = time;

						await new Promise((res) => (video.onseeked = res));
						ctx.drawImage(video, 0, 0);

						const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
						const arrayBuffer = await blob.arrayBuffer();
						const tensor = processFrameToTensor(canvas, options);

						results.push({
							tensor,
							timestamp: time * 1000,
							raw: new Blob([arrayBuffer], { type: 'image/png' })
						});
					}

					resolve(results);
				};

				video.onerror = () => reject(new Error('Failed to load video'));
			});
		},

		/**
		 * @param {File} file
		 * @param {Object} options
		 * @returns {Promise<tf.Tensor[]>}
		 */
		async decodeTiffToTensors(file, options = {}) {
			// Not implemented yet
			throw new Error('decodeTiffToTensors not implemented in browser env');
		},

		/**
		 * @param {File} file
		 * @param {Object} options
		 * @returns {Promise<tf.Tensor>}
		 */
		async decodeTextToTensor(file, options = {}) {
			const text = await file.text();
			const chars = text.split('').map((char) => char.charCodeAt(0));
			return tf.tensor(chars).expandDims(0);
		},

		// Data ===> Human
		tensorToBlob: async (tensor, data) => {
			const imageTensor = tensor.squeeze(); // Remove batch dim
			const canvas = document.createElement('canvas');
			const [h, w, c] = imageTensor.shape;

			canvas.width = w;
			canvas.height = h;

			const ctx = canvas.getContext('2d');
			const imageData = new ImageData(
				new Uint8ClampedArray(await tf.browser.toPixels(imageTensor)),
				w,
				h
			);
			ctx.putImageData(imageData, 0, 0);

			return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
		},

		fileLikeToBlob: async (input, data) => {
			if (input instanceof Blob || input instanceof File) {
				return input;
			}
			throw new Error('Unsupported file-like input in browser');
		},

		complexToBlob: async (input, data) => {
			if (!(input instanceof Blob)) {
				throw new Error('Expected input to be a Blob or File (video)');
			}

			// Optionally you can validate mime type
			if (!input.type.startsWith('video/')) {
				throw new Error('Invalid input type for video blob');
			}

			// Return as-is or clone if needed
			return new Blob([input], { type: input.type });
		},

		imageTransform: async (input, type, options) => {
			if (!(input instanceof File)) {
				throw new Error('Input must be a File object');
			}

			const img = await loadImageElementFromFile(input);

			const canvas = document.createElement('canvas');
			canvas.width = img.width;
			canvas.height = img.height;
			const ctx = canvas.getContext('2d');

			ctx.drawImage(img, 0, 0);

			if (type === 'add_bounding_boxes') {
				if (!options.boxes || !Array.isArray(options.boxes)) {
					return { file: input };
				}

				ctx.strokeStyle = 'red';
				ctx.fillStyle = 'red';
				ctx.lineWidth = 2;
				ctx.font = '16px Arial';

				options.boxes.forEach(({ bbox, class: label, score }) => {
					if (!bbox) return;
					const [x, y, w, h] = bbox;
					ctx.strokeRect(x, y, w, h);
					ctx.fillText(
						`${label || 'object'}${score ? ` (${(score * 100).toFixed(1)}%)` : ''}`,
						x,
						y > 10 ? y - 5 : y + 15
					);
				});
			} else if (type === 'add_segmentation_mask') {
				const mask = options.mask;
				if (!mask || typeof mask.data !== 'function') {
					throw new Error('Segmentation mask must be a valid tensor');
				}

				// Resize mask to image size
				let tensor = mask;

				// Squeeze all singleton dims except H and W
				// Find dims corresponding to height and width and preserve them, squeeze others
				const shape = tensor.shape;
				if (shape.length > 4) {
					// Common convention for segmentation masks: [batch?, height, width, channels?]
					// We want [height, width] or [height, width, channels]
					// So squeeze batch and extra dims:
					tensor = tensor.squeeze([0, 1, 4]); // squeeze dims 0,1,4 if they are 1, ignore errors
				} else if (shape.length === 4 && shape[0] === 1) {
					// squeeze batch dim
					tensor = tensor.squeeze([0]);
				} else if (shape.length === 3 && shape[0] === 1) {
					tensor = tensor.squeeze([0]);
				}

				// Now tensor should be rank 2 or 3: [H, W] or [H, W, C]

				if (tensor.shape.length === 2) {
					// add channels dim for resize
					tensor = tensor.expandDims(-1); // shape: [H, W, 1]
				}

				const resized = tf.image.resizeNearestNeighbor(tensor, [canvas.height, canvas.width]);

				const maskData = await resized.data();

				const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

				for (let i = 0; i < maskData.length; i++) {
					if (maskData[i] > 0.5) {
						imgData.data[i * 4 + 0] = 255; // R
						imgData.data[i * 4 + 1] = 0; // G
						imgData.data[i * 4 + 2] = 0; // B
						imgData.data[i * 4 + 3] = 128; // A (semi-transparent overlay)
					}
				}

				ctx.putImageData(imgData, 0, 0);
				tf.dispose([resized, tensor]);
			} else {
				throw new Error(`Unknown transform type: ${type}`);
			}

			const blob = await new Promise((res) => canvas.toBlob(res, input.type || 'image/png'));

			return {
				file: new File([blob], input.name || 'image.png', {
					type: input.type || 'image/png'
				})
			};
		},

		async convertImagesToVideo(inputImages, options = {}) {
			const {
				fps = 15,
				width = null,
				height = null,
				mimeType = 'video/webm',
				fileName = 'output.webm'
			} = options;

			// Validate input
			if (!Array.isArray(inputImages) || inputImages.length === 0) {
				throw new Error('Input must be a non-empty array of image-like objects');
			}

			// Create canvas
			const firstImg = await loadImage(inputImages[0]);
			const targetWidth = width || firstImg.width;
			const targetHeight = height || firstImg.height;

			const canvas = document.createElement('canvas');
			canvas.width = targetWidth;
			canvas.height = targetHeight;
			const ctx = canvas.getContext('2d');

			// Setup MediaRecorder
			const stream = canvas.captureStream(fps);
			const recordedChunks = [];
			const recorder = new MediaRecorder(stream, { mimeType });

			recorder.ondataavailable = (e) => {
				if (e.data.size > 0) recordedChunks.push(e.data);
			};

			const startRecording = new Promise((res) => (recorder.onstart = res));
			const stopRecording = new Promise((res) => (recorder.onstop = res));

			recorder.start();
			await startRecording;

			// Draw each image frame
			for (const image of inputImages) {
				const img = await loadImage(image);
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
				await new Promise((r) => setTimeout(r, 1000 / fps));
			}

			recorder.stop();
			await stopRecording;

			const blob = new Blob(recordedChunks, { type: mimeType });
			return new File([blob], fileName, { type: mimeType, lastModified: Date.now() });
		},

    resolveModelLibraryPath(){
      return "/"
    }
	}
};

function loadImageElementFromFile(file) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const reader = new FileReader();

		reader.onload = () => {
			img.src = reader.result;
		};

		img.onload = () => resolve(img);
		img.onerror = (err) => reject(err);

		reader.onerror = (err) => reject(err);
		reader.readAsDataURL(file);
	});
}

function fileToImageElement(file) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const reader = new FileReader();

		reader.onload = () => {
			img.src = reader.result;
		};

		img.onload = () => resolve(img);
		img.onerror = reject;
		reader.onerror = reject;

		reader.readAsDataURL(file);
	});
}

async function decodeImageToTensor(file, options = {}) {
	const {
		targetHeight,
		targetWidth,
		targetChannels,
		normalize,
		addBatchDim = false,
		dtype = null
	} = options;

	const norm = normalize ?? false;

	const img = await loadImageElementFromFile(file);
	let tensor = tf.browser.fromPixels(img);

	tensor = tf.image.resizeBilinear(tensor, [targetHeight, targetWidth]);

	if (norm === '0-1') {
		tensor = tensor.toFloat().div(255);
	} else if (norm === '-1-1') {
		tensor = tensor.toFloat().div(127.5).sub(1);
	} else if (dtype === 'float32') {
		tensor = tensor.toFloat();
	} else if (dtype === 'int32') {
		tensor = tensor.toInt();
	}

	if (tensor.shape[2] !== targetChannels) {
		if (tensor.shape[2] === 3 && targetChannels === 1) {
			tensor = tf.image.rgbToGrayscale(tensor);
		} else {
			throw new Error(`Expected ${targetChannels} channels but got ${tensor.shape[2]}`);
		}
	}

	if (addBatchDim) {
		tensor = tensor.expandDims(0);
	}

	return tensor;
}

function processFrameToTensor(canvas, options = {}) {
	const { resize = null, normalize = false, addBatchDim = false, dtype = null } = options;

	let tensor = tf.browser.fromPixels(canvas); // shape: [h, w, 3]

	if (resize) {
		tensor = tf.image.resizeBilinear(tensor, resize);
	}

	if (normalize) {
		tensor = tensor.toFloat().div(255.0);
	} else if (dtype === 'float32') {
		tensor = tensor.toFloat();
	} else if (dtype === 'int32') {
		tensor = tensor.toInt();
	}

	if (addBatchDim) {
		tensor = tensor.expandDims(0); // shape: [1, h, w, 3]
	}

	return tensor;
}

function loadImage(input) {
	return new Promise((resolve, reject) => {
		if (input instanceof HTMLImageElement) return resolve(input);

		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => resolve(img);
		img.onerror = reject;

		if (input instanceof Blob || input instanceof File) {
			img.src = URL.createObjectURL(input);
		} else if (typeof input === 'string') {
			img.src = input;
		} else {
			reject(new Error('Unsupported image input type'));
		}
	});
}


async function decodeImageToTensorBrowser(file, options) {
  // image can be HTMLImageElement, HTMLCanvasElement, ImageData
  // Use tf.browser.fromPixels for these
  const image = await loadImageElementFromFile(file);


  let imgTensor = tf.browser.fromPixels(image);
  console.log(options)
  console.log("====")
  const [batch, height, width, channels] = options.inputShape;
  if (height > 0 && width > 0 &&
    (imgTensor.shape[0] !== height || imgTensor.shape[1] !== width)) {
  imgTensor = tf.image.resizeBilinear(imgTensor, [height, width]);
}

  if (options.dtype === 'float32') {
    imgTensor = imgTensor.toFloat();
    if (options.normalize) {
      imgTensor = imgTensor.div(255);
    }
  } else if (options.dtype === 'int32') {
    imgTensor = imgTensor.toInt();
  }

  imgTensor = addBatchDimIfNeeded(imgTensor, options.addBatchDim);

  return imgTensor;

  // let imgTensor = tf.browser.fromPixels(image);

  // // Resize if needed
  // const [batch, height, width, channels] = options.inputShape;
  // if (imgTensor.shape[0] !== height || imgTensor.shape[1] !== width) {
  //   imgTensor = tf.image.resizeBilinear(imgTensor, [height, width]);
  // }

  // // Convert dtype if needed
  // if (options.dtype === 'float32') {
  //   imgTensor = imgTensor.toFloat();
  //   if (options.normalize) {
  //     imgTensor = imgTensor.div(255); // normalize to [0,1]
  //   }
  // } else if (options.dtype === 'int32') {
  //   imgTensor = imgTensor.toInt();
  // }

  // // Add batch dimension if missing
  // if (imgTensor.shape.length === 3) {
  //   imgTensor = imgTensor.expandDims(0); // add batch dim
  // }

  // return imgTensor;
}


function addBatchDimIfNeeded(tensor, addBatchDim) {
  if (addBatchDim && tensor.shape.length === 3) {
    return tensor.expandDims(0);
  }
  return tensor;
}