import { Data } from "./data.js";
import { Library } from "./models.js";

/**
 * InferenceTask
 * -------------
 * Handles model loading, preparing Data, and running inference
 * in either main thread or a web worker.
 */
export class InferenceTask {
  /**
   * @param {Object} options
   * @param {Object} options.env - environment object with tf and helpers
   * @param {string} options.model_name - model identifier
   * @param {string|Object} [options.model_files] - path or object for custom model
   * @param {Object} [options.model_meta] - model metadata
   * @param {Object} [options.worker] - optional web worker
   * @param {"main_thread"|"web_worker"} [options.run_mode="main_thread"]
   */
  constructor({
    env,
    model_name,
    model_files = null,
    model_meta = null,
    worker = null,
    run_mode = "main_thread",
    name = null,
  }) {
    if (!env || !env.tf) throw new Error("env with tf required");
    if (!model_name) throw new Error("model_name required");

    this.env = env;
    this.tf = env.tf;

    this.model_name = model_name;
    this.model_files = model_files;
    this.model = null;
    this.model_meta = model_meta;

    this.input_data_obj = null; // instance of Data
    this.input_data_map = {}; // { key: { tensor } }
    this.output_data_map = {}; // { key: result }
    this.timings = {
      preprocessing: 0, // total data processing from Data obj
      tensor_creation: 0, // total tensor creation from Data obj
      serialization: 0, // time spent of serializing data when running on a web worker
      model_loading: 0, // time to load the model
      inference: 0, // total time to run the inference on all files
      post_processing: 0, // total time to post process
    };
    this.task_start_time = new Date();
    this.worker = worker;
    this.run_mode = run_mode;
    this.name = name;
  }

  /** Load a Data object, create tensors, and (if worker mode) serialize them */
  async load_data(data_obj) {
    if (!data_obj) throw new Error("Data object required");

    if (!data_obj instanceof Data) {
      throw new Error("Expected object of Data class");
    }

    this.input_data_obj = data_obj;

    await this.load_model_meta();

    // 1) create tensors on the main thread
    const model_options = Library.get_model_options(
      this.model_name,
      this.model
    );
    //console.log(model_options);
    await this.input_data_obj.create_tensors(this.model_name, model_options);

    // 2) build input_data_map
    this.input_data_map = {};

    if (this.run_mode === "web_worker") {
      const serializationStart = Date.now();
      this._transferables = [];
      this.input_data_map = {};

      for (const key of this.input_data_obj.filelist) {
        const modelEntry =
          this.input_data_obj.get_item(key).models[this.model_name];
        const tensors = Array.isArray(modelEntry.tensor)
          ? modelEntry.tensor
          : [modelEntry.tensor];

        const serialized = tensors.map((t) => {
          if (!(t instanceof this.env.tf.Tensor)) {
            throw new Error("Expected tf.Tensor in worker mode serialization");
          }
          const ta = t.dataSync(); // TypedArray view (may have byteOffset!)
          //  zero-copy with offset/length metadata
          this._transferables.push(ta.buffer);
          return {
            buffer: ta.buffer,
            byteOffset: ta.byteOffset, // <-- important
            length: ta.length, // <-- important (elements, not bytes)
            dtype: t.dtype,
            shape: t.shape,
          };
        });

        this.input_data_map[key] = {
          input_tensor: serialized,
          results: modelEntry.results || {},
          derived: modelEntry.derived || {},
        };
      }
      // capture total time taken to serialize the input data
      this.timings.serialization = Date.now() - serializationStart;
    } else {
      // main thread mode keeps live tensors
      for (const key of this.input_data_obj.filelist) {
        const modelEntry =
          this.input_data_obj.get_item(key).models[this.model_name];
        const tensors = Array.isArray(modelEntry.tensor)
          ? modelEntry.tensor
          : [modelEntry.tensor];

        this.input_data_map[key] = {
          tensors, // ALWAYS array of tf.Tensors
          results: modelEntry.results || {},
          derived: modelEntry.derived || {},
        };
      }
    }
  }

  // returns model metadata which is mainly required to generate model specific tensors from the Data class
  async load_model_meta() {
    if (!this.model_meta) {
      this.model_meta = await Library.get_model(this.model_name);
    }
  }

  /** Run inference */
  async run_model(progress_callback = null) {
    if (!this.input_data_obj)
      throw new Error("Data not loaded. Call load_data() first.");

    // name this task
    this.task_name_check();

    if (this.run_mode === "main_thread") {
      // the model needs to be loaded in the main thread then inference run on each input
      if (!this.model) await this.load_model();
      await this._run_model_main_thread(progress_callback);
    } else if (this.run_mode === "web_worker") {
      if (!this.worker) throw new Error("Worker not provided");
      await this._run_model_web_worker(progress_callback);
    } else {
      throw new Error(`Unsupported run_mode: ${this.run_mode}`);
    }

    //return this.output_data_map;
  }

  /** Load model into memory (main thread only) */
  async load_model() {
    if (this.model) return;
    const stime = Date.now();
    if (this.model_name === "custom") {
      if (!this.model_files)
        throw new Error("model_files required for custom model");
      this.model = await this.tf.loadLayersModel(this.model_files);
    } else {
      this.model = await Library.load_model(
        this.env,
        this.env.basePath,
        this.model_name
      );
    }
    this.timings.model_loading = Date.now() - stime;
  }

  task_name_check() {
    // to add a name to a task if not provided
    if (!this.name) {
      let f_len = this.input_data_obj?.filelist.length ?? 0;
      let model_type = "";
      switch (this.model_meta.type) {
        case "segment_image":
          model_type = "Segmentation";
          break;
        case "object_detection":
          model_type = "Object detection";
          break;
        default:
          model_type = "Inference";
      }
      this.name = `${model_type} of ${f_len} file${
        f_len == "1" ? "" : "s"
      } using ${this.model_name}`;
    }
  }
/** Execute inference on main thread */
async _run_model_main_thread(progress_callback) {
  this.output_data_map = {};

  const keys = this.input_data_obj.filelist;
  const total = keys.length;

  for (let i = 0; i < total; i++) {
    const key = keys[i];
    const stime = Date.now();

    try {
      // Validate entry
      const entry = this.input_data_map[key];
      if (!entry || !Array.isArray(entry.tensors)) {
        throw new Error(`No tensors found for key "${key}". Did you call load_data()?`);
      }

      const tensors = entry.tensors;
      const perItemOutputs = [];

      // Run inference based on model type
      if (this.model_name === "tf.coco-ssd" && this.model?.detect) {
        for (const t of tensors) {
          const out = await this.model.detect(t);
          perItemOutputs.push(out);
        }
      } else if (this.model?.predict) {
        for (const t of tensors) {
          const out = this.model.predict(t);
          perItemOutputs.push(out);
        }
      } else {
        throw new Error(`Unsupported model interface for ${this.model_name}`);
      }

      // Store results with timing
      const inferenceTime = Date.now() - stime;
      this.input_data_obj.add_results(key, this.model_name, perItemOutputs, inferenceTime);
      this.output_data_map[key] = perItemOutputs;

      // Report progress (helps prevent timeout)
      if (progress_callback) {
        progress_callback(Math.round(((i + 1) / total) * 100));
      }

      // Yield to event loop every few iterations to prevent blocking
      if (i % 5 === 0 || i === total - 1) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }

    } catch (error) {
      console.error(`[Inference Error] Failed to process file "${key}":`, error);
      
      // Store error result
      this.input_data_obj.add_results(key, this.model_name, {
        error: true,
        message: error.message,
        key
      }, Date.now() - stime);
      
      this.output_data_map[key] = {
        error: true,
        message: error.message
      };

      // Continue with next file instead of failing entire batch
      continue;
    }
  }
}


  /** Execute inference in a web worker */
  async _run_model_web_worker(progress_callback) {
    if (!this.worker) throw new Error("Worker not initialized");
    if (!this.input_data_obj) throw new Error("No data loaded");

    // tensors were serialized in load_data() when run_mode === "web_worker"
    if (!this.input_data_map || !this._transferables) {
      throw new Error("Worker input not prepared. Call load_data() first.");
    }

    return new Promise((resolve, reject) => {
      const handle_message = (e) => {
        const {
          type,
          percent,
          output_map,
          timing_map,
          model_timing,
          error,
          run_time,
        } = e.data || {};

        if (type === "progress" && progress_callback) {
          progress_callback(percent);
        } else if (type === "done") {
          this.output_data_map = output_map || {};
          for (const key of Object.keys(this.output_data_map)) {
            this.input_data_obj.add_results(
              key,
              this.model_name,
              this.output_data_map[key],
              timing_map[key]
            );
          }
          this.timings.model_loading = model_timing;
          this.worker.removeEventListener("message", handle_message);
          console.log(this.output_data_map);
          console.log(this.input_data_map);
          resolve();
        } else if (type === "error") {
          this.worker.removeEventListener("message", handle_message);
          reject(error);
        }
      };

      this.worker.addEventListener("message", handle_message);

      // just send what load_data prepared
      this.worker.postMessage(
        {
          type: "run_inference",
          model_name: this.model_name,
          model_files: this.model_files,
          model_meta: this.model_meta,
          input_map: this.input_data_map, // already serialized arrays
          basePath: this.env.basePath, // plain string, no functions
        },
        this._transferables // the ArrayBuffers gathered in load_data
      );
    });
  }

  /**
   * Generate preview/download artifacts after inference.
   * Image-only, task_type: "object_detection".
   *
   * Returns:
   * {
   *   items: [
   *     {
   *       key,
   *       raw_file: File,
   *       bbox_image: File|null,
   *       crops: File[],              // cropped objects
   *       objects: Array<{class,score,bbox}> // plain objects list
   *     }, ...
   *   ],
   *   downloads: {
   *     raw_files: Array<{file: File, name: string}>,
   *     bbox_images: Array<{file: File, name: string}>,
   *     crops: Array<{file: File, name: string}>
   *   },
   *   summary: { total_files, total_bbox_images, total_crops, total_objects }
   * }
   */
  async generate_outputs() {
    if (!this.input_data_obj) {
      throw new Error("No Data loaded. Call load_data() first.");
    }

    const postProcessStartTotal = Date.now();
    const task_type = this.model_meta.type;

    // Calculate aggregate timings from Data class
    let totalPreprocessing = 0;
    let totalTensorCreation = 0;
    let totalInference = 0;

    for (const key of this.input_data_obj.filelist) {
      const entry = this.input_data_obj.get_item(key);
      totalPreprocessing += entry.timings.preprocessing || 0;
      totalTensorCreation += entry.timings.tensor_creation || 0;
      totalInference += entry.models[this.model_name]?.timing || 0;
    }

    // Update aggregate timings
    this.timings.preprocessing = totalPreprocessing;
    this.timings.tensor_creation = totalTensorCreation;
    this.timings.inference = totalInference;

    // Build base output structure
    const outputData = {
      task: {
        id: `task_${this.task_start_time || Date.now()}`,
        name: this.name,
        status: "completed",
        created_at: this.task_start_time
          ? new Date(this.task_start_time).toISOString()
          : null,
        completed_at: null, // Will be set at the end
        // duration_ms: 0,
      },
      model: {
        name: this.model_name,
        type: task_type,
        meta: this.model_meta,
      },
      execution: {
        run_mode: this.run_mode,
        environment: typeof window !== "undefined" ? "browser" : "node",
        total_files: this.input_data_obj.filelist.length,
        files_processed: 0,
      },
      timings: this.timings,
      input_options: this.input_data_obj.options,
      files: [],
      statistics: {},
    };

    // Generate task-specific outputs
    if (task_type === "object_detection") {
      await this._generate_object_detection_outputs(outputData);
    } else if (task_type === "segment_image") {
      await this._generate_segmentation_outputs(outputData);
    } else {
      throw new Error(`generate_outputs: unsupported task_type "${task_type}"`);
    }

    // Finalize timing
    this.timings.post_processing = Date.now() - postProcessStartTotal;
    outputData.timings = this.timings;
    outputData.task.completed_at = new Date().toISOString();
    // outputData.task.duration_ms =
    //   this.task_end_time && this.task_start_time
    //     ? this.task_end_time - this.task_start_time
    //     : Object.values(this.timings).reduce((a, b) => a + b, 0);
    return outputData;
  }

  /**
   * Generate outputs for object detection tasks.
   * Creates bbox images and object crops for each input file.
   *
   * @private
   */
  async _generate_object_detection_outputs(outputData) {
    let totalDetections = 0;
    const detectionsByClass = {};

    for (let index = 0; index < this.input_data_obj.filelist.length; index++) {
      const key = this.input_data_obj.filelist[index];
      const filePostProcessStart = Date.now();

      const entry = this.input_data_obj.get_item(key);

      if (entry.type !== "image") {
        continue;
      }

      const rawFile = entry.raw_file;
      const inputs = entry.input;
      const detectionsPerInput =
        this.input_data_obj.get_results(key, this.model_name) || [];

      // Flatten detections
      const allDetections = detectionsPerInput.flat();
      totalDetections += allDetections.length;

      // Count by class
      allDetections.forEach((det) => {
        const className = det.class || det.label || "unknown";
        detectionsByClass[className] = (detectionsByClass[className] || 0) + 1;
      });

      // Generate visualization (bbox image)
      const bboxImages = await this.env.generate_inference_output(
        "object_detection",
        inputs,
        detectionsPerInput,
        "bounding_boxes"
      );
      const bboxImage = Array.isArray(bboxImages) ? bboxImages[0] : null;

      // Generate derivatives (crops)
      const cropLists = await this.env.generate_inference_output(
        "object_detection",
        inputs,
        detectionsPerInput,
        "crop_objects"
      );
      const crops = Array.isArray(cropLists) ? cropLists[0] || [] : [];

      // Build outputs array
      const outputs = [];

      if (bboxImage) {
        outputs.push({
          type: "bbox_image",
          file: bboxImage,
          name: bboxImage.name || `${key}_boxes.png`,
          category: "visualization",
        });
      }

      crops.forEach((cropFile, cropIndex) => {
        const detection = allDetections[cropIndex];
        outputs.push({
          type: "crop",
          file: cropFile,
          name: cropFile.name || `${key}_crop_${cropIndex}.png`,
          category: "derivative",
          metadata: detection
            ? {
                class: detection.class || detection.label,
                score: detection.score || detection.confidence,
                bbox: detection.bbox,
              }
            : null,
        });
      });

      // generate timings
      // Calculate post-processing time for this file
      const postProcessingTime = Date.now() - filePostProcessStart;

      // Get timings from Data object
      const inferenceTime = entry.models[this.model_name]?.timing || 0;

      // Add to output
      outputData.files.push({
        key,
        type: entry.type,
        index,
        input: rawFile,
        timings: {
          preprocessing: entry.timings.preprocessing,
          tensor_creation: entry.timings.tensor_creation,
          inference: inferenceTime,
          post_processing: postProcessingTime,
        },
        outputs,
      });

      outputData.execution.files_processed++;
    }

    // Calculate statistics
    outputData.statistics = {
      total_detections: totalDetections,
      detections_by_class: detectionsByClass,
      average_detections_per_file:
        outputData.execution.files_processed > 0
          ? (totalDetections / outputData.execution.files_processed).toFixed(2)
          : 0,
    };
  }

  /**
   * Generate outputs for image segmentation tasks.
   * Creates masks and overlays for each input file/video.
   *
   * @private
   */
  async _generate_segmentation_outputs(outputData) {
    let filesWithMasks = 0;

    for (let index = 0; index < this.input_data_obj.filelist.length; index++) {
      const key = this.input_data_obj.filelist[index];
      const filePostProcessStart = Date.now();

      const entry = this.input_data_obj.get_item(key);

      if (!["video", "image"].includes(entry.type)) {
        continue;
      }

      const rawFile = entry.raw_file;
      const inputs = entry.input;
      const masksPerInput =
        this.input_data_obj.get_results(key, this.model_name) || [];

      // Generate mask
      const maskOutput = await this.env.generate_inference_output(
        "segment_image",
        inputs,
        masksPerInput,
        "mask",
        { ...this.input_data_obj.options, name: key, output_type: "mask" },
        entry.type
      );
      const maskFile = Array.isArray(maskOutput) ? maskOutput[0] : maskOutput;

      // Generate overlay
      const overlayOutput = await this.env.generate_inference_output(
        "segment_image",
        inputs,
        masksPerInput,
        "overlay",
        { ...this.input_data_obj.options, name: key, output_type: "overlay" },
        entry.type
      );
      const overlayFile = Array.isArray(overlayOutput)
        ? overlayOutput[0]
        : overlayOutput;

      if (maskFile) filesWithMasks++;

      // Build outputs array
      const outputs = [];

      if (maskFile) {
        outputs.push({
          type: "mask",
          file: maskFile,
          name:
            maskFile.name ||
            `${key}_mask.${entry.type === "video" ? "mp4" : "png"}`,
          category: "derivative",
        });
      }

      if (overlayFile) {
        outputs.push({
          type: "overlay",
          file: overlayFile,
          name:
            overlayFile.name ||
            `${key}_overlay.${entry.type === "video" ? "mp4" : "png"}`,
          category: "visualization",
        });
      }

      // Calculate post-processing time for this file
      const postProcessingTime = Date.now() - filePostProcessStart;

      // Get timings from Data object
      const inferenceTime = entry.models[this.model_name]?.timing || 0;

      // Add to output
      outputData.files.push({
        key,
        type: entry.type,
        index,
        input: rawFile,
        timings: {
          preprocessing: entry.timings.preprocessing,
          tensor_creation: entry.timings.tensor_creation,
          inference: inferenceTime,
          post_processing: postProcessingTime,
        },
        outputs,
      });

      outputData.execution.files_processed++;
    }

    // Calculate statistics
    outputData.statistics = {
      files_with_masks: filesWithMasks,
      mask_percentage:
        outputData.execution.files_processed > 0
          ? (
              (filesWithMasks / outputData.execution.files_processed) *
              100
            ).toFixed(2)
          : 0,
    };
  }
}
