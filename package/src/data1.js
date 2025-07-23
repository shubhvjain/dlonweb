/**
 * This file contains methods to process data. The 2 main categories of data processing tasks include
 * - preparing the input for inference/training task
 * - encoding the raw images output into image
 * At this time we are only dealing with image data. This includes single image, image stack and videos. All of these requires separate processing
 *
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import * as GeoTIFF from 'geotiff';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg  = null;
const initFFmpeg = async () => {  
    const baseURL = "/ffmpeg";
    //ffmpeg = ffmpegRef.current;
    ffmpeg.on("log", ({ message }) => {
        console.log(message)
    });

    //  {coreURL:"http://localhost:8081/ffmpeg-core.js" }

    await ffmpeg.load(
        {
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
            wasmURL: await toBlobURL(
                `${baseURL}/ffmpeg-core.wasm`,
                "application/wasm"
            ),
            workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),

        }

    );
    console.log('loaded ffmpeg');
};

const convertFramesToVideo1 = async (renderedFrames, selectedFps, name) => {

    ffmpeg.createDir(`${name.toString()}`);
   
    for (let i = 0; i < renderedFrames.length; i += 1) {
        const num = `00${i}`.slice(-3);
        ffmpeg.writeFile(`${name.toString()}/frame_${num}.png`, await fetchFile(renderedFrames[i]));
    }
   
    //yuv420p instead of 'gray'
    await ffmpeg.exec(['-framerate', selectedFps.toString() , '-pattern_type', 'glob', '-i', `${name.toString()}/frame_*.png`, '-c:v', 'libx264', '-pix_fmt', 'gray', `${name.toString()}_output.mp4`]);
    const videoData = await ffmpeg.readFile(`${name.toString()}_output.mp4`);
    const videoBlob = new Blob([videoData.buffer], { type: 'video/mp4' });
    const videoUrl = URL.createObjectURL(videoBlob);

    return videoUrl;
};



// this is the main method to read the file and get the appropriate instance of file object (Image,Video or Image stack )
export const load_input = async (file, options = {}) => {
  if (!file) {
    throw new Error("No file provided ");
  }
  const extension = file.name.split(".").pop().toLowerCase();
  const type = file.type || "";

  if (type.startsWith("image/") && !["tiff", "tif"].includes(extension)) {
    // Simple image file
    const file_raw = await file.arrayBuffer();
    return await BaseImage.fromFile(file);
  } else if (type.startsWith("video/")) {
    // Video file – extract frames
    let fps = options.fps ?? 1;
    let v = await VideoFile.fromFile(file, fps);
    await v.decode((fps = fps));
    return v;
  } else if (["tiff", "tif"].includes(extension)) {
    // Multi-page TIFF stack
    return await ImageStackFile.fromFile(file); // Assumes such a method exists
  } else {
    throw new Error(`Unsupported input file type: ${file.name}`);
  }
};

export class BaseImage {
  /**
   * @param {Object} metadata
   * @param {File} metadata.file
   * @param {ArrayBuffer} metadata.file_raw
   * @param {string} metadata.file_type
   * @param {string} metadata.file_name
   * @param {string} metadata.file_extension
   * @param {number} metadata.image_width
   * @param {number} metadata.image_height
   */
  constructor({
    file,
    file_raw,
    file_type,
    file_name,
    file_extension,
    image_width,
    image_height,
  }) {
    this.file = file;
    this.file_raw = file_raw;
    this.file_type = file_type;
    this.file_name = file_name;
    this.file_extension = file_extension;
    this.image_width = image_width;
    this.image_height = image_height;
  }

  static async fromFile(file) {
    const file_raw = await file.arrayBuffer();
    const file_type = file.type;
    const file_name = file.name;
    const file_extension = file.name.split(".").pop().toLowerCase();

    if (!file_type.startsWith("image/")) {
      throw new Error(`Invalid file type for BaseImage: ${file_type}`);
    }

    const url = URL.createObjectURL(new Blob([file_raw], { type: file_type }));
    const img = await BaseImage._loadImageFromURL(url);

    return new BaseImage({
      file,
      file_raw,
      file_type,
      file_name,
      file_extension,
      image_width: img.naturalWidth,
      image_height: img.naturalHeight,
    });
  }

  static async fromBlob(blob, file_name = "image.png") {
    const file_type = blob.type;
    const file_extension = file_name.split(".").pop().toLowerCase();
    const file_raw = await blob.arrayBuffer();

    const url = URL.createObjectURL(blob);
    const img = await BaseImage._loadImageFromURL(url);

    return new BaseImage({
      file: new File([blob], file_name, { type: file_type }),
      file_raw,
      file_type,
      file_name,
      file_extension,
      image_width: img.naturalWidth,
      image_height: img.naturalHeight,
    });
  }

  static async fromTensor(
    tensor,
    file_type = "image/png",
    file_name = "tensor_image.png"
  ) {
    const [h, w, c] = tensor.shape;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    await tf.browser.toPixels(tensor, canvas);

    const blob = await new Promise((res) => canvas.toBlob(res, file_type));
    return BaseImage.fromBlob(blob, file_name);
  }

  static _loadImageFromURL(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  toBlob() {
    return new Blob([this.file_raw], { type: this.file_type });
  }

  toObjectURL() {
    return URL.createObjectURL(this.toBlob());
  }

  async toTensor({
    targetWidth = 224,
    targetHeight = 224,
    normalize = true,
  } = {}) {
    const img = await BaseImage._loadImageFromURL(this.toObjectURL());
    return tf.tidy(() => {
      let tensor = tf.browser.fromPixels(img);
      tensor = tf.image.resizeBilinear(tensor, [targetHeight, targetWidth]);
      return normalize ? tensor.div(255.0).expandDims(0) : tensor.expandDims(0);
    });
  }

  clone() {
    return new BaseImage({
      file: new File([this.file_raw.slice(0)], this.file_name, {
        type: this.file_type,
      }),
      file_raw: this.file_raw.slice(0),
      file_type: this.file_type,
      file_name: this.file_name,
      file_extension: this.file_extension,
      image_width: this.image_width,
      image_height: this.image_height,
    });
  }

  async _loadHTMLImage() {
    const img = new Image();
    img.src = this.toObjectURL();
    await img.decode();
    return img;
  }

  async transform(type, options) {
    if (type == "bounding_boxes") {
      const img = await this._loadHTMLImage();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      if (options.boxes) {
        ctx.strokeStyle = "red";
        ctx.fillStyle = "red";
        ctx.lineWidth = 2;
        ctx.font = "16px Arial";

        options.boxes.forEach(({ bbox, class: label, score }) => {
          if (!bbox) return;
          const [x, y, w, h] = bbox;
          ctx.strokeRect(x, y, w, h);
          ctx.fillText(
            `${label} (${(score * 100).toFixed(1)}%)`,
            x,
            y > 10 ? y - 5 : y + 15
          );
        });
      } else {
        throw new Error("No bounding boxes provided in options ");
      }

      const blob = await new Promise((res) =>
        canvas.toBlob(res, this.file_type)
      );
      const buffer = await blob.arrayBuffer();
      this.file = new File([blob], this.file_name, { type: this.file_type });
      this.file_raw = buffer;
    } else {
      throw new Error("Invalid transform");
    }
  }
}

export class VideoFile {
  /**
   * @param {File} file
   */
  constructor(file) {
    if (!file.type.startsWith("video/")) {
      throw new Error(`Invalid file type for VideoFile: ${file.type}`);
    }
    this.file = file;
    this.file_name = file.name;
    this.file_type = file.type;
    this._videoElement = null;
    this._duration = null;
    this._fps = null;
    this._frames = [];
  }

  static async fromFile(file) {
    const video = new VideoFile(file);
    await video._loadMetadata();
    return video;
  }

  async _loadMetadata() {
    const url = URL.createObjectURL(this.file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = url;

    await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => {
        this._duration = video.duration;
        this._videoElement = video;
        URL.revokeObjectURL(url);
        resolve();
      };
      video.onerror = () => {
        reject(new Error("Failed to load video metadata."));
      };
    });
  }

  get duration() {
    return this._duration;
  }

  get fps() {
    return this._fps;
  }

  get frames() {
    return this._frames;
  }

  /**
   * Extract frames from the video at given FPS
   * @param {number} fps
   * @returns {Promise<void>}
   */
  async decode(fps = 1) {
    if (!this._videoElement) {
      await this._loadMetadata();
    }

    this._fps = fps;
    const frameCount = Math.floor(this._duration * fps);

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const width = this._videoElement.videoWidth;
    const height = this._videoElement.videoHeight;

    canvas.width = width;
    canvas.height = height;

    this._frames = [];

    for (let i = 0; i < frameCount; i++) {
      const time = i / fps;
      await this._seekTo(time);

      context.clearRect(0, 0, width, height);
      context.drawImage(this._videoElement, 0, 0, width, height);

      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) continue;

      const baseImage = await BaseImage.fromBlob(
        blob,
        `${this.file_name}_frame_${i}.png`
      );
      this._frames.push(baseImage);
    }
  }

  _seekTo(timeInSeconds) {
    return new Promise((resolve, reject) => {
      const onSeeked = () => {
        this._videoElement.removeEventListener("seeked", onSeeked);
        resolve();
      };
      this._videoElement.addEventListener("seeked", onSeeked);
      this._videoElement.currentTime = timeInSeconds;
    });
  }

  /**
   * Create a shallow clone of the video with no frames
   * @returns {VideoFile}
   */
  cloneEmpty() {
    const clone = new VideoFile(this.file);
    clone.file_name = this.file_name;
    clone.file_type = this.file_type;
    clone._duration = this._duration;
    clone._fps = this._fps;
    clone._frames = []; // important: do not carry over frames
    clone._videoElement = null; // delay loading video element
    return clone;
  }

  /**
   * Export segmented frames to a downloadable .webm video
   * @param {BaseImage[] | ImageFile[]} frames - Segmented image frames
   * @param {number} fps - Frames per second
   * @returns {Promise<Blob>} - The generated video blob
   */
  /**
   * Convert decoded frames into an MP4 video using ffmpeg.wasm
   * @param {number} [fps=this._fps] - Frames per second for the output video (optional, defaults to the video's fps)
   * @returns {Promise<string>} - A Blob URL pointing to the generated MP4 video
   */
  async convertFramesToVideo(fps = this._fps) {
    if (!this._frames.length) {
      throw new Error(
        "No frames to convert. Please decode the video frames first."
      );
    }
    if (!fps) {
      throw new Error("FPS not specified or decoded.");
    }
    let frames = []
    this._frames.map(itm=>{
      frames.push(itm.toObjectURL())
    })
    ffmpeg = new FFmpeg()

    await initFFmpeg()
    let vid = await convertFramesToVideo1(frames,this._fps,Math.floor(Math.random()*10000)+"")
    // Convert BaseImage frames to File objects (needed by ffmpeg)
   console.log(vid)
  }
}




export class ImageStackFile {
  /**
   * @param {File} file
   */
  constructor(file) {
    if (!file.name.toLowerCase().endsWith('.tif') && !file.name.toLowerCase().endsWith('.tiff')) {
      throw new Error(`Invalid file type for ImageStackFile: ${file.name}`);
    }
    this.file = file;
    this.file_name = file.name;
    this.file_type = file.type || 'image/tiff';
    this._tiff = null;
    this._images = [];
  }

  /**
   * Create an ImageStackFile from a TIFF file.
   * @param {File} file
   * @returns {Promise<ImageStackFile>}
   */
  static async fromFile(file) {
    const stack = new ImageStackFile(file);
    await stack._loadStack();
    return stack;
  }

  /**
   * Load and parse the TIFF stack into BaseImage instances.
   * @private
   */
  async _loadStack() {
    const buffer = await this.file.arrayBuffer();
    this._tiff = await GeoTIFF.fromArrayBuffer(buffer);
    const imageCount = await this._tiff.getImageCount();

    for (let i = 0; i < imageCount; i++) {
      const image = await this._tiff.getImage(i);
      const raster = await image.readRasters({ interleave: true });
      const width = image.getWidth();
      const height = image.getHeight();
      const samplesPerPixel = image.getSamplesPerPixel();

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      const imageData = ctx.createImageData(width, height);

      for (let j = 0; j < width * height; j++) {
        const baseIndex = j * samplesPerPixel;
        const r = raster[baseIndex] ?? 0;
        const g = raster[baseIndex + 1] ?? r;
        const b = raster[baseIndex + 2] ?? r;

        imageData.data[j * 4 + 0] = Math.min(255, Math.round(r / 256)); // normalize 16-bit
        imageData.data[j * 4 + 1] = Math.min(255, Math.round(g / 256));
        imageData.data[j * 4 + 2] = Math.min(255, Math.round(b / 256));
        imageData.data[j * 4 + 3] = 255;
      }

      ctx.putImageData(imageData, 0, 0);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      const baseImage = await BaseImage.fromBlob(blob, `${this.file_name}_page_${i}.png`);
      this._images.push(baseImage);
    }
  }

  /**
   * Get number of pages (images) in the stack.
   */
  get length() {
    return this._images.length;
  }

  /**
   * Get image at index.
   * @param {number} index
   * @returns {BaseImage}
   */
  get(index) {
    if (index < 0 || index >= this._images.length) {
      throw new Error(`Index out of bounds: ${index}`);
    }
    return this._images[index];
  }

  /**
   * Return all frames in the stack
   * @returns {BaseImage[]}
   */
  getAllFrames() {
    return this._images.slice();
  }

  /**
   * Clone an empty version of the stack.
   * @returns {ImageStackFile}
   */
  cloneEmpty() {
    const clone = new ImageStackFile(this.file);
    clone._tiff = this._tiff;
    clone._images = [];
    return clone;
  }
}
