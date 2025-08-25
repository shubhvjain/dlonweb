// adapter.browser.js (add/replace the parts below)
import * as tf from '@tensorflow/tfjs';
import { base } from '$app/paths';

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
    throw new Error("_decodeImage received an array. Call decodeToTensor with the array instead.");
  }

  const img = await this._loadImageElement(fileOrBlob);

  const {
    inputShape = null,          // e.g. [1,256,256,3] or [1,null,null,3]
    dtype = "float32",
    normalize = false,          // true | "0-1" | "-1-1" | { mean:[...], std:[...] }
    addBatchDim = false,
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
    let x = tf.browser.fromPixels(img);             // [H,W,3] (RGB)
    if (x.shape[2] === 4) x = x.slice([0,0,0], [-1,-1,3]); // just in case

    // Resize only if model input shape declares concrete H & W
    if (targetH && targetW) {
      x = tf.image.resizeBilinear(x, [targetH, targetW], true);
    }

    // DType
    if (dtype === "float32") x = x.toFloat();
    else if (dtype === "int32") x = x.toInt();
    else x = x.asType(dtype);

    // Normalization
    if (normalize && dtype !== "float32") {
      // Avoid silent mistakes: normalization requires float math
      x = x.toFloat();
    }
    if (normalize && typeof normalize === "object" && normalize.mean && normalize.std) {
      const mean = tf.tensor1d(normalize.mean, "float32");
      const std  = tf.tensor1d(normalize.std, "float32");
      x = x.sub(mean).div(std);
      mean.dispose(); std.dispose();
    } else if (normalize === true || normalize === "0-1") {
      x = x.div(255);
    } else if (normalize === "-1-1") {
      x = x.div(127.5).sub(1);
    }

    // If inputShape declares channels=1 or 3, enforce it
    if (Array.isArray(inputShape) && inputShape.length >= 4) {
      const C = inputShape[3];
      if (C === 1 && x.shape[2] !== 1) {
        x = tf.image.rgbToGrayscale(x);
      } else if (C === 3 && x.shape[2] !== 3) {
        // (rare) grayscale -> rgb
        if (x.shape[2] === 1) x = x.tile([1,1,3]);
      }
    }

    if (addBatchDim) x = x.expandDims(0);          // [1,H,W,C]
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
	}
};
