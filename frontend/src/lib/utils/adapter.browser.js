// adapter.browser.js (add/replace the parts below)
import * as tf from '@tensorflow/tfjs';
import { base } from '$app/paths';

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// --------------------------------------------
// FFmpeg helper (images[] -> MP4)
// --------------------------------------------
async function imagesToVideo(images, options = { fps: 10, name: 'output.mp4',output_type:"original" }) {
	if (!crossOriginIsolated) {
		throw new Error(
			'Video cannot be processed on your browser (crossOriginIsolation required). Try Node.js.'
		);
	}

	//const baseURL = `${base}/ffmpeg` //'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm';
	const baseURL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm';

	const ffmpeg = new FFmpeg();
	await ffmpeg.load({
		coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
		wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
		workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript')
	});

	// Write frames
	for (let i = 0; i < images.length; i++) {
		const filename = `img${String(i).padStart(4, '0')}.png`;
		await ffmpeg.writeFile(filename, await fetchFile(images[i]));
	}

	// Build concat list
	const list = images.map((_, i) => `file 'img${String(i).padStart(4, '0')}.png'`).join('\n');
	await ffmpeg.writeFile('input.txt', list);

	await ffmpeg.exec([
		'-r',
		String(options.fps ?? 10),
		'-f',
		'concat',
		'-safe',
		'0',
		'-i',
		'input.txt',
		'-vf',
		`fps=${options.fps ?? 10}`,
		'-pix_fmt',
		'yuv420p',
		'out.mp4'
	]);

	const data = await ffmpeg.readFile('out.mp4');
	const blob = new Blob([data.buffer], { type: 'video/mp4' });
	const base = (options?.name || 'video').replace(/\.[^.]+$/, '');
  const output_name  =  `${base}_${options?.output_type||"original"}.mp4`
	return new File([blob], output_name, {
		type: 'video/mp4',
		lastModified: Date.now()
	});
}

export const adaptor = {
	tf,

	/** Base path + resolver used by Library.load_model */
	basePath: `${base}/`,

	/** Detect type of input file or tensor */
	detectType(input) {
		if (input instanceof tf.Tensor) return 'tensor';
		if (input instanceof File || input instanceof Blob) {
			const type = input.type || '';
			const name = input.name || '';
			const ext = name.split('.').pop().toLowerCase();
			if (type.startsWith('image/') && !['tiff', 'tif'].includes(ext)) return 'image';
			if (type.startsWith('video/')) return 'video';
			if (['tiff', 'tif'].includes(ext)) return 'tiff'; // optional, not handled below
			if (type.startsWith('text/') || ext === 'txt') return 'text';
		}
		return null;
	},

	/** Extract filename from File object */
	getFileName(file) {
		if (file instanceof File) return file.name;
		// Fallback for Blob without name
		return `blob_${Math.random().toString(36).slice(2)}`;
	},

	/** Read file into ArrayBuffer (if you ever need it) */
	async readFile(file) {
		if (!(file instanceof Blob)) throw new Error('Expected File/Blob');
		return await file.arrayBuffer();
	},

	/**
	 * Preprocess a raw file to an array of atomic inputs.
	 * image -> [imageFile]
	 * video -> [frameBlob, frameBlob, ...]
	 * text  -> [file]  (you can add chunking later)
	 */
	async processFile(file, { type, fps = 10, startAt = 0, endAt = null, maxFrames = null } = {}) {
		const detected = type || this.detectType(file);

		if (detected === 'image') {
			return [file];
		}

		if (detected === 'video') {
			return await this._extractVideoFrames(file, { fps, startAt, endAt, maxFrames });
		}

		if (detected === 'text') {
			// keep as a single item for now; you can add chunking policy later
			return [file];
		}

		throw new Error(`Unsupported type for processFile: ${detected}`);
	},

	/**
	 * Decode one or many processed inputs into tensors.
	 * Always returns an array of tf.Tensor.
	 * NOTE: if datatype === 'video', inputs are already frames → treat as 'image'.
	 */
	async decodeToTensor(rawData, datatype, model_options = {}) {
		// Normalize to array (image → [file], video frames → [blob, ...], text → [file])
		const inputs = Array.isArray(rawData) ? rawData : [rawData];
		if (inputs.length === 0) return [];

		// processFile already expands video → frames, so decode images per-frame
		const effectiveType = datatype === 'video' ? 'image' : datatype;

		const out = [];
		for (const item of inputs) {
			switch (effectiveType) {
				case 'image': {
					if (Array.isArray(item)) {
						throw new Error(
							'decodeToTensor(image): got an Array item. Pass the whole list to decodeToTensor, not _decodeImage.'
						);
					}
					const t = await this._decodeImage(item, model_options);
					out.push(t);
					break;
				}
				case 'text': {
					if (Array.isArray(item)) {
						throw new Error(
							'decodeToTensor(text): got an Array item. Pass the whole list to decodeToTensor, not _decodeText.'
						);
					}
					const t = await this._decodeText(item, model_options);
					out.push(t);
					break;
				}
				default:
					throw new Error(`Unsupported input type in decodeToTensor: ${effectiveType}`);
			}
		}

		// ALWAYS an array of tensors
		return out;
	},

	/** Internal image decoding → Tensor3D (or 4D if addBatchDim) */
	/** Decode File/Blob → Tensor3D/4D using *standard* options only */
	async _decodeImage(fileOrBlob, options = {}) {
		if (Array.isArray(fileOrBlob)) {
			throw new Error(
				'_decodeImage received an array. Call decodeToTensor with the array instead.'
			);
		}

		const img = await this._loadImageElement(fileOrBlob);

		const {
			inputShape = null, // e.g. [1,256,256,3] or [1,null,null,3]
			dtype = 'float32',
			normalize = false, // true | "0-1" | "-1-1" | { mean:[...], std:[...] }
			addBatchDim = false
		} = options;

		// helper: pick H,W from inputShape if fixed
		const getHW = (shape) => {
			if (!Array.isArray(shape) || shape.length < 4) return [null, null];
			const H = Number(shape[1]);
			const W = Number(shape[2]);
			const hOk = Number.isFinite(H) && H > 0;
			const wOk = Number.isFinite(W) && W > 0;
			return [hOk ? H : null, wOk ? W : null];
		};

		const [targetH, targetW] = getHW(inputShape);
		const out = tf.tidy(() => {
			let x = tf.browser.fromPixels(img); // [H,W,3] (RGB)
			if (x.shape[2] === 4) x = x.slice([0, 0, 0], [-1, -1, 3]); // just in case

			// Resize only if model input shape declares concrete H & W
			if (targetH && targetW) {
				x = tf.image.resizeBilinear(x, [targetH, targetW], true);
			}

			// DType
			if (dtype === 'float32') x = x.toFloat();
			else if (dtype === 'int32') x = x.toInt();
			else x = x.asType(dtype);

			// Normalization
			if (normalize && dtype !== 'float32') {
				// Avoid silent mistakes: normalization requires float math
				x = x.toFloat();
			}
			if (normalize && typeof normalize === 'object' && normalize.mean && normalize.std) {
				const mean = tf.tensor1d(normalize.mean, 'float32');
				const std = tf.tensor1d(normalize.std, 'float32');
				x = x.sub(mean).div(std);
				mean.dispose();
				std.dispose();
			} else if (normalize === true || normalize === '0-1') {
				x = x.div(255);
			} else if (normalize === '-1-1') {
				x = x.div(127.5).sub(1);
			}

			// If inputShape declares channels=1 or 3, enforce it
			if (Array.isArray(inputShape) && inputShape.length >= 4) {
				const C = inputShape[3];
				if (C === 1 && x.shape[2] !== 1) {
					x = tf.image.rgbToGrayscale(x);
				} else if (C === 3 && x.shape[2] !== 3) {
					// (rare) grayscale -> rgb
					if (x.shape[2] === 1) x = x.tile([1, 1, 3]);
				}
			}

			if (addBatchDim) x = x.expandDims(0); // [1,H,W,C]
			return x;
		});

		return out;
	},

	/** Internal text decoding → simple numeric tensor (toy example) */
	async _decodeText(fileOrBlob) {
		// If it's a File/Blob, read the text; otherwise coerce to string
		const text = fileOrBlob instanceof Blob ? await fileOrBlob.text() : String(fileOrBlob);
		const chars = text.split('').map((c) => c.charCodeAt(0));
		return tf.tensor(chars).expandDims(0); // [1, N]
	},

	/**
	 * Extract frames from a video File/Blob as PNG Blobs.
	 * Returns an array of Blob objects (type: image/png).
	 */
	async _extractVideoFrames(file, { fps = 10, startAt = 0, endAt = null, maxFrames = null } = {}) {
		const video = document.createElement('video');
		video.src = URL.createObjectURL(file);
		video.crossOrigin = 'anonymous';
		video.preload = 'auto';
		video.muted = true;

		return new Promise((resolve, reject) => {
			video.onloadedmetadata = async () => {
				const duration = video.duration;
				const from = Math.max(0, startAt);
				const to = endAt != null ? Math.min(endAt, duration) : duration;

				const canvas = document.createElement('canvas');
				canvas.width = video.videoWidth;
				canvas.height = video.videoHeight;
				const ctx = canvas.getContext('2d');

				const frames = [];
				const totalFrames = Math.floor((to - from) * fps);
				const limit = maxFrames ? Math.min(totalFrames, maxFrames) : totalFrames;

				for (let i = 0; i < limit; i++) {
					const t = from + i / fps;
					video.currentTime = t;
					await new Promise((res) => (video.onseeked = res));
					ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

					// Canvas to PNG Blob (frame)
					// NOTE: some browsers need a small delay between seeks; if you see black frames, add await new Promise(r=>setTimeout(r, 0))
					const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
					frames.push(blob);
				}

				resolve(frames);
			};
			video.onerror = () => reject(new Error('Failed to load video'));
		});
	},

	/** Load image from File/Blob */
	async _loadImageElement(fileOrBlob) {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.crossOrigin = 'anonymous';

			if (fileOrBlob instanceof Blob) {
				const url = URL.createObjectURL(fileOrBlob);
				img.onload = () => {
					URL.revokeObjectURL(url);
					resolve(img);
				};
				img.onerror = (e) => {
					URL.revokeObjectURL(url);
					reject(e);
				};
				img.src = url;
			} else if (typeof fileOrBlob === 'string') {
				img.onload = () => resolve(img);
				img.onerror = reject;
				img.src = fileOrBlob;
			} else {
				reject(new Error('Unsupported image input'));
			}
		});
	},

	/** Convert tensor to image blob (helper you already had) */
	async tensorToBlob(tensor, type = 'image/png') {
		const imageTensor = tensor.squeeze(); // remove batch if present
		const [h, w, c] = imageTensor.shape;
		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d');

		const pixels = await tf.browser.toPixels(imageTensor);
		const imgData = new ImageData(new Uint8ClampedArray(pixels), w, h);
		ctx.putImageData(imgData, 0, 0);

		return new Promise((res) => canvas.toBlob(res, type));
	},



	
	/**
	 * Generate task-specific, user-facing outputs from inference results.
	 * @param {"object_detection"} task_type
	 * @param {File|Blob|Array<File|Blob>} rawinput  - original image(s) or frame blobs
	 * @param {Array|Array[]} predicted_results      - detections per image/frame
	 * @param {"bounding_boxes"|"crop_objects"|"objects"} output_type
	 * @returns {Promise<any>}  // see returns by output_type below
	 */
	async generate_inference_output(task_type, rawinput, predicted_results, output_type,input_options={},input_type="image") {
		if (task_type == 'object_detection') {
			// Normalize inputs to arrays
			const inputs = Array.isArray(rawinput) ? rawinput : [rawinput];
			const results = Array.isArray(predicted_results) ? predicted_results : [predicted_results];

			if (inputs.length !== results.length) {
				throw new Error(
					`Input/Result length mismatch: got ${inputs.length} inputs vs ${results.length} results`
				);
			}

			switch (output_type) {
				case 'bounding_boxes': {
					// RETURNS: File[] (PNG overlays), one per input image
					const outImages = [];
					for (let i = 0; i < inputs.length; i++) {
						const file = inputs[i];
						const dets = Array.isArray(results[i]) ? results[i] : [];
						const overlaid = await this._drawDetectionsOnImage(file, dets);
						outImages.push(overlaid);
					}
					return outImages;
				}

				case 'crop_objects': {
					// RETURNS: File[][] (per image, array of cropped object images)
					const outCrops = [];
					for (let i = 0; i < inputs.length; i++) {
						const file = inputs[i];
						const dets = Array.isArray(results[i]) ? results[i] : [];
						const crops = await this._cropDetectionsFromImage(file, dets);
						outCrops.push(crops);
					}
					return outCrops;
				}

				case 'objects': {
					// RETURNS: {class, score, bbox:[x,y,w,h]}[][]  (per image)
					const outObjects = [];
					for (let i = 0; i < inputs.length; i++) {
						const dets = Array.isArray(results[i]) ? results[i] : [];
						outObjects.push(
							dets.map((d) => ({
								class: d.class ?? d.label ?? 'object',
								score: d.score ?? d.confidence ?? null,
								bbox: Array.isArray(d.bbox) ? d.bbox.slice(0, 4) : null
							}))
						);
					}
					return outObjects;
				}

				default:
					throw new Error(`Unsupported output_type: ${output_type}`);
			}
		} else if (task_type == 'segment_image') {
			if (output_type !== 'mask' && output_type !== 'overlay') {
				throw new Error(`Unsupported output_type: ${output_type} (expected "mask" or "overlay")`);
			}

			const isVideo = input_type == "video" ; // you store video as array of frame Files
			//console.log()
			const inputs = rawinput 

			// Normalize predicted_results → array of mask tensors (one per frame/image)
			const masks = predicted_results;
			//console.log(masks)
			if (inputs.length !== masks.length) {
				throw new Error(
					`Input/Mask length mismatch: ${inputs.length} inputs vs ${masks.length} masks`
				);
			}

			// Render each frame/image to a PNG (mask or overlay)
			const framePNGs = [];
			for (let i = 0; i < inputs.length; i++) {
				const imgFile = inputs[i];
				//const maskT = masks[i]; // tf.Tensor: [H,W] or [H,W,1] (probabilities or 0/1)
				let maskT = this._toTensor(masks[i]); 
				// if (!(maskT instanceof tf.Tensor)) {
				// 	throw new Error(`Expected tf.Tensor for mask at index ${i}`);
				// }
				//console.log(maskT)

				const png =
					output_type === 'mask'
						? await this._renderMaskPNG(imgFile, maskT, input_options)
						: await this._renderOverlayPNG(imgFile, maskT, input_options);

				framePNGs.push(png);
			}

			// If video → assemble MP4 from framePNGs
			if (isVideo) {
				const fps = input_options.fps ?? 10;
				const name = output_type === 'mask' ? 'mask.mp4' : 'overlay.mp4';
				return await imagesToVideo(framePNGs, input_options);
			}

			// Otherwise return per-image PNGs
			return framePNGs;
		} else {
			throw new Error(`Unsupported task_type: ${task_type}`);
		}
	},


/**
 * Coerce any "tensor-like" value into a real tf.Tensor.
 * Supports:
 *  - tf.Tensor (returned as-is)
 *  - { __tensor__, buffer|data|values, shape, dtype }
 *  - TypedArray
 *  - Nested JS arrays (last resort)
 */
_toTensor(x) {
  // Already a tf.Tensor?
  if (x && typeof x.data === 'function' && Array.isArray(x.shape)) {
    return x;
  }

  // Serialized form
  if (x && (x.__tensor__ || Array.isArray(x?.shape))) {
    const dtype = x.dtype || 'float32';

    let flat;
    if (x.buffer instanceof ArrayBuffer) {
      // pick typed view by dtype if you support more dtypes
      switch (dtype) {
        case 'float32': flat = new Float32Array(x.buffer); break;
        case 'int32':   flat = new Int32Array(x.buffer);   break;
        case 'bool':    flat = new Uint8Array(x.buffer);   break;
        default:        flat = new Float32Array(x.buffer);
      }
    } else if (x.data || x.values) {
      const src = x.data || x.values;
      if (ArrayBuffer.isView(src)) {
        flat = src;
      } else {
        // assume number[]
        flat = new Float32Array(src);
      }
    } else {
      throw new Error('Serialized tensor missing data/buffer');
    }

    return tf.tensor(flat, x.shape, dtype);
  }

  // TypedArray directly
  if (ArrayBuffer.isView(x)) return tf.tensor(x);

  // Plain array (fallback)
  if (Array.isArray(x)) return tf.tensor(x);

  throw new Error('Unsupported mask format; expected tf.Tensor or serialized tensor-like object');
},

/**
 * Normalize a mask to rank 2 or 3 and resize to [targetH, targetW].
 * Accepts masks shaped like [H,W], [H,W,1], [1,H,W], or [1,H,W,1].
 * Returns rank-2 tensor [H,W] (single-channel).
 */
_normalizeAndResizeMask(t, targetH, targetW) {
  let m = t;
  if (!(m && typeof m.data === 'function')) {
    throw new Error('maskTensor is not a tf.Tensor');
  }
  if (m.dtype !== 'float32') m = m.toFloat();

  // Squeeze common singleton dims safely
  // [1,H,W,1] -> [H,W,1] -> [H,W]
  if (m.rank === 4 && m.shape[0] === 1) m = m.squeeze([0]);     // [1,H,W,C] -> [H,W,C]
  if (m.rank === 4 && m.shape[3] === 1) m = m.squeeze([3]);     // [H,W,1]   -> [H,W]
  if (m.rank === 3 && m.shape[2] === 1) m = m.squeeze([2]);     // [H,W,1]   -> [H,W]

  // If still rank 4 (a real batch), take the first item
  if (m.rank === 4) {
    m = m.slice([0, 0, 0, 0], [1, m.shape[1], m.shape[2], m.shape[3]]).squeeze([0]);
  }

  // Now we expect rank 2 ([H,W]) or rank 3 ([H,W,C])
  if (m.rank === 2) {
    // make it [H,W,1] for resize, then squeeze
    m = tf.image.resizeNearestNeighbor(m.expandDims(-1), [targetH, targetW]).squeeze([-1]);
  } else if (m.rank === 3) {
    // [H,W,C]; resize directly, then squeeze if single-channel
    m = tf.image.resizeNearestNeighbor(m, [targetH, targetW]);
    if (m.shape[2] === 1) m = m.squeeze([-1]);
  } else {
    throw new Error(`Unexpected mask rank ${m.rank}; expected 2 or 3 after squeezing.`);
  }

  // Ensure float32
  if (m.dtype !== 'float32') m = m.toFloat();
  return m;
},

/**
 * Render a segmentation mask PNG matching the original image size.
 * White opaque pixels where mask > threshold; transparent elsewhere.
 *
 * @param {File|Blob} imageFile
 * @param {tf.Tensor|Object} maskTensor    // real tensor or serialized tensor-like
 * @param {{threshold?: number}} opts
 * @returns {Promise<File>}  PNG file
 */
async _renderMaskPNG(imageFile, maskTensor, { threshold = 0.5 } = {}) {
  const img = await this._loadImageElement(imageFile);
  const [W, H] = [img.width, img.height];

  // Ensure real tensor, normalize & resize
  const m0 = this._toTensor(maskTensor);
  const m  = this._normalizeAndResizeMask(m0, H, W);

  // Read mask values
  const data = await m.data();

  // Draw mask to canvas (white where on, transparent elsewhere)
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(W, H);

  const alphaOn = 255;
  for (let i = 0; i < data.length; i++) {
    const on = data[i] > threshold ? 255 : 0;
    const j = i * 4;
    imgData.data[j + 0] = on;       // R
    imgData.data[j + 1] = on;       // G
    imgData.data[j + 2] = on;       // B
    imgData.data[j + 3] = on ? alphaOn : 0; // A
  }
  ctx.putImageData(imgData, 0, 0);

  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  const base = (imageFile?.name || 'image').replace(/\.[^.]+$/, '');
  const out  = new File([blob], `${base}_mask.png`, { type: 'image/png' });

  // Optional: if you created tensors on the fly, dispose to free memory
  if (m0 !== maskTensor && typeof m0.dispose === 'function') m0.dispose();
  if (m && typeof m.dispose === 'function') m.dispose();

  return out;
},

/**
 * Render an overlay PNG: original image + semi-transparent colored mask.
 *
 * @param {File|Blob} imageFile
 * @param {tf.Tensor|Object} maskTensor
 * @param {{
 *   threshold?: number,
 *   overlayColor?: [number, number, number], // RGB 0..255
 *   overlayAlpha?: number                    // 0..255
 * }} opts
 * @returns {Promise<File>} PNG file
 */
async _renderOverlayPNG(
  imageFile,
  maskTensor,
  {
    threshold = 0.5,
    overlayColor = [255, 0, 0],
    overlayAlpha = 128
  } = {}
) {
  const img = await this._loadImageElement(imageFile);
  const [W, H] = [img.width, img.height];

  // Ensure real tensor, normalize & resize
  const m0 = this._toTensor(maskTensor);
  const m  = this._normalizeAndResizeMask(m0, H, W);
  const data = await m.data();

  // Setup canvas & draw base image
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, W, H);

  // Overlay where mask is on
  const imgData = ctx.getImageData(0, 0, W, H);
  const [r, g, b] = overlayColor;

  for (let i = 0; i < data.length; i++) {
    if (data[i] > threshold) {
      const j = i * 4;
      imgData.data[j + 0] = r;
      imgData.data[j + 1] = g;
      imgData.data[j + 2] = b;
      imgData.data[j + 3] = overlayAlpha;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  const base = (imageFile?.name || 'image').replace(/\.[^.]+$/, '');
  const out  = new File([blob], `${base}_overlay.png`, { type: 'image/png' });

  // Optional disposals
  if (m0 !== maskTensor && typeof m0.dispose === 'function') m0.dispose();
  if (m && typeof m.dispose === 'function') m.dispose();

  return out;
},



	/** Helpers for object-detection post-processing (browser) **/

	/**
	 * Draw bounding boxes + labels over an image/file.
	 * @param {File|Blob} file
	 * @param {Array} detections - [{bbox:[x,y,w,h], class, score}]
	 * @returns {Promise<File>} PNG file with overlays
	 */
	async _drawDetectionsOnImage(file, detections) {
		const img = await this._loadImageElement(file);
		const canvas = document.createElement('canvas');
		canvas.width = img.width;
		canvas.height = img.height;
		const ctx = canvas.getContext('2d');

		// base image
		ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

		// style
		ctx.lineWidth = 2;
		ctx.font = '16px sans-serif';

		detections.forEach((det) => {
			const [x, y, w, h] = (det.bbox || [0, 0, 0, 0]).map((v) => Math.max(0, v));
			// clamp and skip tiny boxes
			const cx = Math.min(x, canvas.width - 1);
			const cy = Math.min(y, canvas.height - 1);
			const cw = Math.max(1, Math.min(w, canvas.width - cx));
			const ch = Math.max(1, Math.min(h, canvas.height - cy));

			// box
			ctx.strokeStyle = 'red';
			ctx.strokeRect(cx, cy, cw, ch);

			// label
			const label = det.class ?? det.label ?? 'object';
			const score = det.score != null ? ` ${(det.score * 100).toFixed(1)}%` : '';
			const text = `${label}${score}`;
			const pad = 4;
			const tw = ctx.measureText(text).width + pad * 2;
			const th = 18 + pad * 2;
			ctx.fillStyle = 'rgba(255,0,0,0.8)';
			ctx.fillRect(cx, Math.max(0, cy - th), tw, th);
			ctx.fillStyle = '#fff';
			ctx.fillText(text, cx + pad, Math.max(12, cy - th + 14));
		});

		const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
		let file_base = file.name.split('.');
		return new File([blob], (file_base[0] || 'image') + '_boxes.png', { type: 'image/png' });
	},

	/**
	 * Crop each detection from an image/file.
	 * @param {File|Blob} file
	 * @param {Array} detections - [{bbox:[x,y,w,h], class, score}]
	 * @returns {Promise<File[]>} cropped object images (PNG)
	 */
	async _cropDetectionsFromImage(file, detections) {
		const img = await this._loadImageElement(file);
		const crops = [];

		for (let i = 0; i < detections.length; i++) {
			const det = detections[i];
			const [x, y, w, h] = (det.bbox || [0, 0, 0, 0]).map((v) => Math.max(0, v));

			// clamp
			const cx = Math.min(x, img.width - 1);
			const cy = Math.min(y, img.height - 1);
			const cw = Math.max(1, Math.min(w, img.width - cx));
			const ch = Math.max(1, Math.min(h, img.height - cy));

			const canvas = document.createElement('canvas');
			canvas.width = cw;
			canvas.height = ch;
			const ctx = canvas.getContext('2d');
			ctx.drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);

			const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
			const label = det.class ?? det.label ?? 'object';
			const score = det.score != null ? `_${Math.round(det.score * 100)}` : '';
			const base = (file.name || 'image').replace(/\.[^.]+$/, '');
			const fname = `${base}_${label}_crop_${i}.png`;
			crops.push(new File([blob], fname, { type: 'image/png' }));
		}

		return crops;
	}
};
