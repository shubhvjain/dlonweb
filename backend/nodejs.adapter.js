// adapter.node.js
const tf = require('@tensorflow/tfjs-node');
const { createCanvas, loadImage } = require('canvas');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs-extra');
const path = require('path');
const { pathToFileURL } = require('url');
const tmp = require('tmp-promise');
const sharp = require('sharp');

// --------------------------------------------
// FFmpeg helper (images[] -> MP4)
// --------------------------------------------
async function imagesToVideo(images, options = { fps: 10, name: 'output.mp4', output_type: 'original' }) {
  const { path: tmpDirPath, cleanup } = await tmp.dir({ unsafeCleanup: true });

  try {
    // Write all image buffers to temp directory
    for (let i = 0; i < images.length; i++) {
      const filename = `img${String(i).padStart(4, '0')}.png`;
      const filePath = path.join(tmpDirPath, filename);
      await fs.writeFile(filePath, images[i].buffer);
    }

    // Create output file
    const { path: outputPath } = await tmp.file({ postfix: '.mp4' });

    // Use ffmpeg to create video
    await new Promise((resolve, reject) => {
      ffmpeg()
        .addInput(path.join(tmpDirPath, 'img%04d.png'))
        .inputFPS(options.fps || 10)
        .videoCodec('libx264')
        .outputOptions('-pix_fmt yuv420p')
        .save(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', (err) => reject(err));
    });

    const videoBuffer = await fs.readFile(outputPath);
    const base = (options?.name || 'video').replace(/\.[^.]+$/, '');
    const output_name = `${base}_${options?.output_type || 'original'}.mp4`;

    return {
      buffer: videoBuffer,
      name: output_name,
      type: 'video/mp4'
    };
  } finally {
    await cleanup();
  }
}

/**
 * Load image buffer into canvas Image, converting WebP if needed
 */
async function loadImageSafe(buffer) {
  // Detect WebP format
  const isWebP = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
                 buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
  
  // Convert WebP to PNG for canvas compatibility
  if (isWebP) {
    buffer = await sharp(buffer).png().toBuffer();
  }
  
  return loadImage(buffer);
}


module.exports.adaptor = {
  tf,

  /** Base path + resolver */
  basePath: null, // will be set by resolveModelLibraryPath()

  /** Resolve model library path */
  resolveModelLibraryPath() {
    const modelPath = path.resolve('node_modules', 'dlonwebjs', 'public');
    return pathToFileURL(modelPath).href + '/';
  },

  /** Detect type of input file or tensor */
  detectType(input) {
    if (input && typeof input.data === 'function' && Array.isArray(input.shape)) {
      return 'tensor';
    }
    if (input && input.buffer) {
      const type = input.mimetype || input.type || '';
      const name = input.originalname || input.name || '';
      const ext = name.split('.').pop().toLowerCase();

      if (type.startsWith('image/') && !['tiff', 'tif'].includes(ext)) return 'image';
      if (type.startsWith('video/')) return 'video';
      if (['tiff', 'tif'].includes(ext)) return 'tiff';
      if (type.startsWith('text/') || ext === 'txt') return 'text';
    }
    return null;
  },

  /** Extract filename from file object */
  getFileName(file) {
    if (file.originalname) return file.originalname;
    if (file.name) return file.name;
    return `file_${Math.random().toString(36).slice(2)}`;
  },

  /** Read file into ArrayBuffer */
  async readFile(file) {
    if (!file.buffer) throw new Error('Expected file with buffer property');
    return file.buffer.buffer.slice(
      file.buffer.byteOffset,
      file.buffer.byteOffset + file.buffer.byteLength
    );
  },

  /**
   * Preprocess a raw file to an array of atomic inputs.
   * image -> [file]
   * video -> [frameFile, frameFile, ...]
   * text  -> [file]
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
      return [file];
    }

    throw new Error(`Unsupported type for processFile: ${detected}`);
  },

  /**
   * Decode one or many processed inputs into tensors.
   * Always returns an array of tf.Tensor.
   */
  async decodeToTensor(rawData, datatype, model_options = {}) {
    const inputs = Array.isArray(rawData) ? rawData : [rawData];
    if (inputs.length === 0) return [];

    const effectiveType = datatype === 'video' ? 'image' : datatype;

    const out = [];
    for (const item of inputs) {
      switch (effectiveType) {
        case 'image': {
          if (Array.isArray(item)) {
            throw new Error('decodeToTensor(image): got an Array item.');
          }
          const t = await this._decodeImage(item, model_options);
          out.push(t);
          break;
        }
        case 'text': {
          if (Array.isArray(item)) {
            throw new Error('decodeToTensor(text): got an Array item.');
          }
          const t = await this._decodeText(item, model_options);
          out.push(t);
          break;
        }
        default:
          throw new Error(`Unsupported input type in decodeToTensor: ${effectiveType}`);
      }
    }

    return out;
  },

/** Internal image decoding - Tensor3D/4D */
/** Internal image decoding → Tensor3D/4D */
async _decodeImage(file, options = {}) {
  if (Array.isArray(file)) {
    throw new Error('_decodeImage received an array. Call decodeToTensor with the array instead.');
  }

  if (!file.buffer || !Buffer.isBuffer(file.buffer)) {
    throw new Error('Invalid file: buffer is missing or not a Buffer');
  }

  const {
    inputShape = null,
    dtype = 'float32',
    normalize = false,
    addBatchDim = false
  } = options;

  const getHW = (shape) => {
    if (!Array.isArray(shape) || shape.length < 4) return [null, null];
    const H = Number(shape[1]);
    const W = Number(shape[2]);
    const hOk = Number.isFinite(H) && H > 0;
    const wOk = Number.isFinite(W) && W > 0;
    return [hOk ? H : null, wOk ? W : null];
  };

  const [targetH, targetW] = getHW(inputShape);

  // Use sharp - handles all formats
  let sharpInstance = sharp(file.buffer);
  
  // Resize if needed
  if (targetH && targetW) {
    sharpInstance = sharpInstance.resize(targetH, targetW, { 
      fit: 'fill',
      kernel: 'lanczos3' 
    });
  }

  // Extract raw RGB pixels (remove alpha if present)
  const { data, info } = await sharpInstance
    .removeAlpha()  // ← Fixed: use removeAlpha() instead of ensureAlpha(false)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = tf.tidy(() => {
    // Create tensor from raw pixels [H, W, 3]
    let x = tf.tensor3d(new Uint8Array(data), [info.height, info.width, info.channels]);

    // Should be 3 channels after removeAlpha
    if (x.shape[2] !== 3) {
      if (x.shape[2] === 1) {
        x = x.tile([1, 1, 3]); // Grayscale to RGB
      } else if (x.shape[2] > 3) {
        x = x.slice([0, 0, 0], [-1, -1, 3]); // Take first 3 channels
      }
    }

    // DType conversion
    if (dtype === 'float32') x = x.toFloat();
    else if (dtype === 'int32') x = x.toInt();
    else x = x.asType(dtype);

    // Normalization
    if (normalize && dtype !== 'float32') {
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

    // Channel enforcement
    if (Array.isArray(inputShape) && inputShape.length >= 4) {
      const C = inputShape[3];
      if (C === 1 && x.shape[2] !== 1) {
        x = tf.image.rgbToGrayscale(x);
      }
    }

    if (addBatchDim) x = x.expandDims(0);
    return x;
  });

  return out;
},



  /** Internal text decoding */
  async _decodeText(file) {
    const text = file.buffer.toString('utf-8');
    const chars = text.split('').map((c) => c.charCodeAt(0));
    return tf.tensor(chars).expandDims(0);
  },

  /** Extract frames from video file */
  async _extractVideoFrames(file, { fps = 10, startAt = 0, endAt = null, maxFrames = null } = {}) {
    const { path: tmpDirPath, cleanup } = await tmp.dir({ unsafeCleanup: true });

    try {
      const inputPath = path.join(tmpDirPath, 'input.mp4');
      await fs.writeFile(inputPath, file.buffer);

      const outputPattern = path.join(tmpDirPath, 'frame_%04d.png');

      // Get video duration
      const metadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(inputPath, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const duration = metadata.format.duration;
      const from = Math.max(0, startAt);
      const to = endAt != null ? Math.min(endAt, duration) : duration;

      // Extract frames
      await new Promise((resolve, reject) => {
        let cmd = ffmpeg(inputPath)
          .outputOptions(['-vf', `fps=${fps}`]);

        if (startAt > 0) cmd = cmd.setStartTime(startAt);
        if (endAt != null) cmd = cmd.setDuration(to - from);

        cmd
          .output(outputPattern)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      const files = await fs.readdir(tmpDirPath);
      const frameFiles = files
        .filter((f) => f.startsWith('frame_') && f.endsWith('.png'))
        .sort();

      const limit = maxFrames ? Math.min(frameFiles.length, maxFrames) : frameFiles.length;
      const frames = [];

      for (let i = 0; i < limit; i++) {
        const framePath = path.join(tmpDirPath, frameFiles[i]);
        const buffer = await fs.readFile(framePath);
        frames.push({
          buffer,
          originalname: frameFiles[i],
          name: frameFiles[i],
          mimetype: 'image/png',
          type: 'image/png'
        });
      }

      return frames;
    } finally {
      await cleanup();
    }
  },

  /** Convert tensor to image buffer */
  async tensorToBlob(tensor, type = 'image/png') {
    const imageTensor = tensor.squeeze();
    const [h, w] = imageTensor.shape;

    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');

    // Get pixel data
    const pixels = await tf.browser.toPixels(imageTensor);
    const imageData = ctx.createImageData(w, h);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);

    return canvas.toBuffer('image/png');
  },

  /**
   * Generate task-specific, user-facing outputs from inference results.
   */
  async generate_inference_output(task_type, rawinput, predicted_results, output_type, input_options = {}, input_type = 'image') {
    if (task_type === 'object_detection') {
      const inputs = Array.isArray(rawinput) ? rawinput : [rawinput];
      const results = Array.isArray(predicted_results) ? predicted_results : [predicted_results];

      if (inputs.length !== results.length) {
        throw new Error(
          `Input/Result length mismatch: got ${inputs.length} inputs vs ${results.length} results`
        );
      }

      switch (output_type) {
        case 'bounding_boxes': {
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
    } else if (task_type === 'segment_image') {
      if (output_type !== 'mask' && output_type !== 'overlay') {
        throw new Error(`Unsupported output_type: ${output_type} (expected "mask" or "overlay")`);
      }

      const isVideo = input_type === 'video';
      const inputs = rawinput;
      const masks = predicted_results;

      if (inputs.length !== masks.length) {
        throw new Error(
          `Input/Mask length mismatch: ${inputs.length} inputs vs ${masks.length} masks`
        );
      }

      const framePNGs = [];
      for (let i = 0; i < inputs.length; i++) {
        const imgFile = inputs[i];
        let maskT = this._toTensor(masks[i]);

        const png =
          output_type === 'mask'
            ? await this._renderMaskPNG(imgFile, maskT, input_options)
            : await this._renderOverlayPNG(imgFile, maskT, input_options);

        framePNGs.push(png);
      }

      if (isVideo) {
        return await imagesToVideo(framePNGs, input_options);
      }

      return framePNGs;
    } else {
      throw new Error(`Unsupported task_type: ${task_type}`);
    }
  },

  /**
   * Coerce any "tensor-like" value into a real tf.Tensor.
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
      if (x.buffer instanceof ArrayBuffer || Buffer.isBuffer(x.buffer)) {
        const buf = Buffer.isBuffer(x.buffer) ? x.buffer : Buffer.from(x.buffer);
        switch (dtype) {
          case 'float32':
            flat = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
            break;
          case 'int32':
            flat = new Int32Array(buf.buffer, buf.byteOffset, buf.length / 4);
            break;
          case 'bool':
            flat = new Uint8Array(buf.buffer, buf.byteOffset, buf.length);
            break;
          default:
            flat = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
        }
      } else if (x.data || x.values) {
        const src = x.data || x.values;
        if (ArrayBuffer.isView(src)) {
          flat = src;
        } else {
          flat = new Float32Array(src);
        }
      } else {
        throw new Error('Serialized tensor missing data/buffer');
      }

      return tf.tensor(flat, x.shape, dtype);
    }

    if (ArrayBuffer.isView(x)) return tf.tensor(x);
    if (Array.isArray(x)) return tf.tensor(x);

    throw new Error('Unsupported mask format; expected tf.Tensor or serialized tensor-like object');
  },

  /**
   * Normalize a mask to rank 2 or 3 and resize.
   */
  _normalizeAndResizeMask(t, targetH, targetW) {
    let m = t;
    if (!(m && typeof m.data === 'function')) {
      throw new Error('maskTensor is not a tf.Tensor');
    }
    if (m.dtype !== 'float32') m = m.toFloat();

    // Squeeze dimensions
    if (m.rank === 4 && m.shape[0] === 1) m = m.squeeze([0]);
    if (m.rank === 4 && m.shape[3] === 1) m = m.squeeze([3]);
    if (m.rank === 3 && m.shape[2] === 1) m = m.squeeze([2]);

    if (m.rank === 4) {
      m = m.slice([0, 0, 0, 0], [1, m.shape[1], m.shape[2], m.shape[3]]).squeeze([0]);
    }

    if (m.rank === 2) {
      m = tf.image.resizeNearestNeighbor(m.expandDims(-1), [targetH, targetW]).squeeze([-1]);
    } else if (m.rank === 3) {
      m = tf.image.resizeNearestNeighbor(m, [targetH, targetW]);
      if (m.shape[2] === 1) m = m.squeeze([-1]);
    } else {
      throw new Error(`Unexpected mask rank ${m.rank}; expected 2 or 3 after squeezing.`);
    }

    if (m.dtype !== 'float32') m = m.toFloat();
    return m;
  },

  /**
   * Render a segmentation mask PNG
   */
  async _renderMaskPNG(imageFile, maskTensor, { threshold = 0.5 } = {}) {
    const img = await loadImageSafe(imageFile.buffer)
    const [W, H] = [img.width, img.height];

    const m0 = this._toTensor(maskTensor);
    const m = this._normalizeAndResizeMask(m0, H, W);
    const data = await m.data();

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(W, H);

    for (let i = 0; i < data.length; i++) {
      const on = data[i] > threshold ? 255 : 0;
      const j = i * 4;
      imgData.data[j + 0] = on;
      imgData.data[j + 1] = on;
      imgData.data[j + 2] = on;
      imgData.data[j + 3] = on ? 255 : 0;
    }
    ctx.putImageData(imgData, 0, 0);

    const buffer = canvas.toBuffer('image/png');
    const base = (imageFile?.originalname || imageFile?.name || 'image').replace(/\.[^.]+$/, '');

    if (m0 !== maskTensor && typeof m0.dispose === 'function') m0.dispose();
    if (m && typeof m.dispose === 'function') m.dispose();

    return {
      buffer,
      name: `${base}_mask.png`,
      type: 'image/png'
    };
  },

  /**
   * Render an overlay PNG
   */
  async _renderOverlayPNG(
    imageFile,
    maskTensor,
    { threshold = 0.5, overlayColor = [255, 0, 0], overlayAlpha = 128 } = {}
  ) {
    const img = await loadImageSafe(imageFile.buffer)
    const [W, H] = [img.width, img.height];

    const m0 = this._toTensor(maskTensor);
    const m = this._normalizeAndResizeMask(m0, H, W);
    const data = await m.data();

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, W, H);

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

    const buffer = canvas.toBuffer('image/png');
    const base = (imageFile?.originalname || imageFile?.name || 'image').replace(/\.[^.]+$/, '');

    if (m0 !== maskTensor && typeof m0.dispose === 'function') m0.dispose();
    if (m && typeof m.dispose === 'function') m.dispose();

    return {
      buffer,
      name: `${base}_overlay.png`,
      type: 'image/png'
    };
  },

  /** Draw bounding boxes over an image */
  async _drawDetectionsOnImage(file, detections) {
    const img = await loadImageSafe(file.buffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2;
    ctx.font = '16px sans-serif';

    detections.forEach((det) => {
      const [x, y, w, h] = (det.bbox || [0, 0, 0, 0]).map((v) => Math.max(0, v));
      const cx = Math.min(x, canvas.width - 1);
      const cy = Math.min(y, canvas.height - 1);
      const cw = Math.max(1, Math.min(w, canvas.width - cx));
      const ch = Math.max(1, Math.min(h, canvas.height - cy));

      ctx.strokeStyle = 'red';
      ctx.strokeRect(cx, cy, cw, ch);

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

    const buffer = canvas.toBuffer('image/png');
    const file_base = (file.originalname || file.name || 'image').split('.');
    return {
      buffer,
      name: `${file_base[0] || 'image'}_boxes.png`,
      type: 'image/png'
    };
  },

  /** Crop each detection from an image */
  async _cropDetectionsFromImage(file, detections) {
    const img = await loadImageSafe(file.buffer);
    const crops = [];

    for (let i = 0; i < detections.length; i++) {
      const det = detections[i];
      const [x, y, w, h] = (det.bbox || [0, 0, 0, 0]).map((v) => Math.max(0, v));

      const cx = Math.min(x, img.width - 1);
      const cy = Math.min(y, img.height - 1);
      const cw = Math.max(1, Math.min(w, img.width - cx));
      const ch = Math.max(1, Math.min(h, img.height - cy));

      const canvas = createCanvas(cw, ch);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);

      const buffer = canvas.toBuffer('image/png');
      const label = det.class ?? det.label ?? 'object';
      const score = det.score != null ? `_${Math.round(det.score * 100)}` : '';
      const base = (file.originalname || file.name || 'image').replace(/\.[^.]+$/, '');
      const fname = `${base}_${label}${score}_crop_${i}.png`;

      crops.push({
        buffer,
        name: fname,
        type: 'image/png'
      });
    }

    return crops;
  }
};

// Initialize basePath on module load
module.exports.adaptor.basePath = module.exports.adaptor.resolveModelLibraryPath();
