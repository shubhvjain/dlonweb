/**
 * Browser Adapter for  Data class
 * Provides environment-specific methods for reading files, detecting types,
 * decoding to tensors, and exporting tensors or derived artifacts.
 */

import * as tf from '@tensorflow/tfjs';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { base } from '$app/paths';

export const adaptor = {
	tf,

	/** Detect type of input file or tensor */
	detectType(input) {
		if (input instanceof tf.Tensor) return 'tensor';
		if (input instanceof File) {
			const ext = input.name.split('.').pop().toLowerCase();
			const type = input.type || '';
			if (type.startsWith('image/') && !['tiff', 'tif'].includes(ext)) return 'image';
			if (type.startsWith('video/')) return 'video';
			if (['tiff', 'tif'].includes(ext)) return 'tiff';
			if (type.startsWith('text/') || ext === 'txt') return 'text';
		}
		return null;
	},

	/** Extract filename from File object */
	getFileName(file) {
		if (file instanceof File) return file.name;
		throw new Error('Expected File object');
	},

	/** Read file into ArrayBuffer */
	async readFile(file) {
		if (!(file instanceof File)) throw new Error('Expected File');
		return await file.arrayBuffer();
	},

	/** Decode image File to tensor */
	async decodeToTensor(rawData, datatype, model_details = {}) {
    console.log(rawData)
    console.log(datatype)
		if (datatype === 'image') return await this._decodeImage(rawData, model_details);
		if (datatype === 'video') return await this._decodeVideo(rawData, model_details);
		if (datatype === 'text') return await this._decodeText(rawData, model_details);
		throw new Error(`Unsupported type: ${type}`);
	},

	/** Internal image decoding */
	async _decodeImage(file, options = {}) {
    console.log(file)
		const img = await this._loadImageElement(file);
		let tensor = tf.browser.fromPixels(img);

		if (options.targetHeight && options.targetWidth) {
			tensor = tf.image.resizeBilinear(tensor, [options.targetHeight, options.targetWidth]);
		}

		if (options.dtype === 'float32') tensor = tensor.toFloat();
		else if (options.dtype === 'int32') tensor = tensor.toInt();

		if (options.normalize)
			tensor = tensor
				.div(options.normalize === '-1-1' ? 127.5 : 255)
				.sub(options.normalize === '-1-1' ? 1 : 0);

		if (options.targetChannels && tensor.shape[2] !== options.targetChannels) {
			if (tensor.shape[2] === 3 && options.targetChannels === 1)
				tensor = tf.image.rgbToGrayscale(tensor);
			else throw new Error(`Expected ${options.targetChannels} channels, got ${tensor.shape[2]}`);
		}

		if (options.addBatchDim) tensor = tensor.expandDims(0);
		return tensor;
	},

	/** Internal video decoding: returns array of frame tensors */
	async _decodeVideo(file, options = { fps: 10 }) {
		const video = document.createElement('video');
		video.src = URL.createObjectURL(file);
		video.crossOrigin = 'anonymous';
		video.preload = 'auto';
		video.muted = true;

		return new Promise((resolve, reject) => {
			video.onloadedmetadata = async () => {
				const duration = video.duration;
				const canvas = document.createElement('canvas');
				canvas.width = video.videoWidth;
				canvas.height = video.videoHeight;
				const ctx = canvas.getContext('2d');
				const frames = [];
				const totalFrames = Math.floor(duration * options.fps);
				for (let i = 0; i < totalFrames; i++) {
					video.currentTime = i / options.fps;
					await new Promise((res) => (video.onseeked = res));
					ctx.drawImage(video, 0, 0);
					const tensor = tf.browser.fromPixels(canvas);
					frames.push(tensor);
				}
				resolve(frames);
			};
			video.onerror = () => reject(new Error('Failed to load video'));
		});
	},

	/** Decode text file to tensor */
	async _decodeText(file) {
		const text = await file.text();
		const chars = text.split('').map((c) => c.charCodeAt(0));
		return tf.tensor(chars).expandDims(0);
	},


  /** Resolve model library path (for InferenceTask,Library) */
  basePath : `${base}/`,

  	/** Load image from File/Blob */
	async _loadImageElement(file) {
		return new Promise((resolve, reject) => {
			const img = new Image();
			const reader = new FileReader();
			reader.onload = () => (img.src = reader.result);
			img.onload = () => resolve(img);
			img.onerror = reject;
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	},

	/** Convert tensor to blob (image) */
	async tensorToBlob(tensor, type = 'image/png') {
		const [h, w] = tensor.shape.slice(0, 2);
		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d');
		const data = await tf.browser.toPixels(tensor);
		const imgData = new ImageData(new Uint8ClampedArray(data), w, h);
		ctx.putImageData(imgData, 0, 0);
		return new Promise((res) => canvas.toBlob(res, type));
	}
};
