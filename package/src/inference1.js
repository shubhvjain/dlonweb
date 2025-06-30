// import * as cocoSsd from '@tensorflow-models/coco-ssd';
// import '@tensorflow/tfjs'; // make sure TFJS is loaded
import { Library } from "./models";
import { BaseImage, load_input, VideoFile } from "./data1";
import { ImageSegmentation } from "./segmentation";
/**
 * Load TensorFlow.js model either from:
 * - a library folder path (URL string)
 * - or user uploaded files (jsonFile + binFiles array)
 * @param {Object} params
 * @param {string} [params.libraryPath] - URL to model.json in your library folder
 * @param {File} [params.userJsonFile] - user-uploaded model.json file
 * @param {File[]} [params.userWeightFiles] - user-uploaded binary weight files
 * @returns {Promise<tf.GraphModel|tf.LayersModel>}
 */
export class InferenceTask {
  /**
   * @param {'classify'|'segment'} task_type
   * @param {ImageFile|VideoFile|ImageStack} input
   * @param {tf.GraphModel|tf.LayersModel} model
   * @param {Object} options - additional options like labels, targetWidth, targetHeight, etc.
   */
  constructor(task_type, input, model = null, options = {}) {
    this.task_type = task_type;
    // input can be of multiple types.
    this.model = model;
    this.options = options;
    this.loaded = false;
    this.input = input;
    console.log("Run load now");
  }

  async load() {
    // load /validate input
    if (this.input) {
      console.log(typeof this.input);
      if (this.input instanceof VideoFile || BaseImage) {
        this.loaded = true;
      } else if (this.input instanceof FileList) {
        this.input = await load_input(this.input);
        this.loaded = true;
      } else {
        throw new Error("invalid input type");
      }
      console.log("loaded");
    } else {
      throw new Error("No input provided");
    }
    // load/validate model
    if (!this.model) {
      throw new Error("No model provided");
    }

    // Load from library name
    if (this.model.libraryModelName) {
      if( this.model.libraryModelName == "tf.coco-ssd"){
        //console.log(cocoSsd)
        this.model = await cocoSsd.load();
      }else{
        const model_details = await Library.get_model(
          this.model.libraryModelName
        );
        const modelUrl = `/${model_details.path}/model.json`; // customize base path if needed
        try {
          this.model = await tf.loadLayersModel(modelUrl);
        } catch (e) {
          throw new Error(`Failed to load model from ${modelUrl}: ${e.message}`);
        }
      }
    }
    // Load from user files
    else if (this.model.userJsonFile && this.model.userWeightFiles?.length) {
      try {
        this.model = await tf.loadGraphModel(
          tf.io.browserFiles([
            this.model.userJsonFile,
            ...this.model.userWeightFiles,
          ])
        );
      } catch (e) {
        throw new Error(`Failed to load user-provided model: ${e.message}`);
      }
    } else {
      throw new Error(
        "Invalid model configuration: Provide a library name or user files"
      );
    }
  }

  check_load() {
    if (this.loaded == false) {
      throw new Error("run load first");
    }
    return this.loaded;
  }

  /**
   * Run the inference task, returns same input type but with predictions attached
   * @returns {Promise<ImageFile|VideoFile|ImageStack>}
   */
  async run() {
    this.check_load();
    switch (this.task_type) {
      case "classify_image":
        return this._runGeneralClassification();
      case "segment_image":
        return this._runSegmentation();
      default:
        throw new Error(`Unsupported task type: ${this.task_type}`);
    }
  }

  async _runSegmentation() {
    // Helper: segment a single BaseImage (ImageFile extends BaseImage)
    const segmentImage = async (imageFile) => {
      const result = await ImageSegmentation.run(this.model, imageFile);
      // Assuming run returns an object { segmented: BaseImage, ... }
      return result.segmented;
    };
  
    if (this.input instanceof BaseImage) {
      // Single image segmentation
      const output = await segmentImage(this.input);
      return output; // segmented BaseImage
    }
  
    if (this.input instanceof VideoFile ) {
      // || this.input instanceof ImageStack
      // Video or stack segmentation
      if (!this.input.frames || this.input.frames.length === 0) {
        throw new Error("Input video/image stack contains no frames.");
      }
  
      // Clone the video/stack metadata but with empty frames
      const segmentedVideo = this.input.cloneEmpty();
  
      // Process frames sequentially or in parallel (here parallel)
      const segmentedFrames = await Promise.all(
        this.input.frames.map((frame) => segmentImage(frame))
      );
  
      // Store segmented frames in the cloned video object
      segmentedVideo._frames = segmentedFrames;
  
      // Preserve fps if applicable
      if (this.input.fps) {
        segmentedVideo._fps = this.input.fps;
      }
  
      return segmentedVideo;
    }
  
    throw new Error("Unsupported input type for segmentation");
  }

  // New GeneralClassification using COCO-SSD model
  async _runGeneralClassification() {
    // If model not loaded, load coco-ssd model internally
    if (!this.model) {
      this.model = await cocoSsd.load();
    }
    // Helper: run detection on single ImageFile
    const detectImage = async (imageFile) => {
      try {
        const prediction = await this.model.detect(imageFile);
        return prediction;
      } catch (error) {
        console.log(error);
        throw error;
      }
    };

    if (this.input instanceof (BaseImage)) {
      let raw_input = await this.input._loadHTMLImage();
      let raw_output = await detectImage(raw_input);
      console.log(raw_output);
      let output_image = this.input.clone();
      await output_image.transform("bounding_boxes", { boxes: raw_output });
      //return detectImage(this.input);
      return output_image;
    } else {
      throw new Error("This can only be run on ImageClass at the moment");
    }
  }
}
