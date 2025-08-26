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
    this.run_times = {
      load_data: 0,
      run: 0,
      generate_output: 0,
    };
    this.worker = worker;
    this.run_mode = run_mode;
    this.name = name;
  }

  now_time() {
    return Date.now();
  }

  /** Load model into memory (main thread only) */
  async load_model() {
    if (this.model) return;
    stime = this.now_time();
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
    etime = this.now_time();
    this.run_times.run += etime - stime;
    console.log("model loaded");
  }

  async load_model_meta() {
    if (!this.model_meta) {
      this.model_meta = await Library.get_model(this.model_name);
    }
  }

  /** Load a Data object, create tensors, and (if worker mode) serialize them */
  async load_data(data_obj) {
    if (!data_obj) throw new Error("Data object required");
    this.input_data_obj = data_obj;

    await this.load_model_meta();

    // 1) create tensors on the main thread
    let stime = this.now_time();
    const model_options = Library.get_model_options(
      this.model_name,
      this.model
    );
    console.log(model_options);
    await this.input_data_obj.create_tensors(this.model_name, model_options);

    // 2) build input_data_map
    this.input_data_map = {};

    if (this.run_mode === "web_worker") {
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
    let etime = this.now_time();
    this.run_times.load_data += etime - stime;
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

  /** Run inference */
  async run_model(progress_callback = null) {
    if (!this.input_data_obj)
      throw new Error("Data not loaded. Call load_data() first.");

    this.task_name_check();

    if (this.run_mode === "main_thread") {
      if (!this.model) await this.load_model();
      await this._run_model_main_thread(progress_callback);
    } else if (this.run_mode === "web_worker") {
      if (!this.worker) throw new Error("Worker not provided");
      await this._run_model_web_worker(progress_callback);
    } else {
      throw new Error(`Unsupported run_mode: ${this.run_mode}`);
    }

    return this.output_data_map;
  }

  /** Execute inference on main thread */
  async _run_model_main_thread(progress_callback) {
    this.output_data_map = {};
    let stime = this.now_time();
    const keys = this.input_data_obj.filelist;
    const total = keys.length;

    for (let i = 0; i < total; i++) {
      const key = keys[i];

      // tensors were prepared in load_data() for main thread mode
      const entry = this.input_data_map[key];
      if (!entry || !Array.isArray(entry.tensors)) {
        throw new Error(
          `No tensors found for key "${key}". Did you call load_data()?`
        );
      }
      const tensors = entry.tensors;

      //console.log(tensors)
      // run per-tensor
      const perItemOutputs = [];
      if (this.model_name === "tf.coco-ssd" && this.model?.detect) {
        for (const t of tensors) {
          //console.log(t)
          const out = await this.model.detect(t);
          perItemOutputs.push(out);
        }
      } else if (this.model?.predict) {
        for (const t of tensors) {
          //console.log(t)
          const out = this.model.predict(t);
          perItemOutputs.push(out);
        }
      } else {
        throw new Error(`Unsupported model interface for ${this.model_name}`);
      }

      // store back into Data + output map
      this.input_data_obj.add_results(key, this.model_name, perItemOutputs);
      this.output_data_map[key] = perItemOutputs;

      if (progress_callback) {
        progress_callback(Math.round(((i + 1) / total) * 100));
      }
    }
    let etime = this.now_time();
    this.run_times.run += etime - stime;
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
        const { type, percent, output_map, error, run_time } = e.data || {};

        if (type === "progress" && progress_callback) {
          progress_callback(percent);
        } else if (type === "done") {
          this.output_data_map = output_map || {};
          for (const key of Object.keys(this.output_data_map)){
            this.input_data_obj.add_results(key, this.model_name,this.output_data_map[key] );
          }
          
          this.worker.removeEventListener("message", handle_message);
          if (run_time) {
            this.run_times.run += run_time;
          }
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

  // InferenceTask.js (add inside the class)

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
    if (!this.input_data_obj)
      throw new Error("No Data loaded. Call load_data() first.");
    let task_type = this.model_meta.type;

    if (task_type == "object_detection") {
      const items = [];
      const flat_raw = [];
      const flat_bbox = [];
      const flat_crops = [];
      let item_name_list = []
      let totalObjects = 0;

      for (const key of this.input_data_obj.filelist) {
        const entry = this.input_data_obj.get_item(key);
        
        //console.log(entry)
        // image-only guard
        if (
          !entry ||
          !(entry.raw_file instanceof File) ||
          !String(entry.type).startsWith("image")
        ) {
          // skip non-image entries for this simple path
          continue;
        }

        item_name_list.push(key)
        const basename = this._filename_base(entry.raw_file.name);
        const rawFile = entry.raw_file;

        // detections were saved earlier by run_model()
        const detectionsPerInput =
          this.input_data_obj.get_results(key, this.model_name) || [];
        // We only expect one input for image (your Data.load() makes input = [rawFile])
        const inputs =  entry.input 

        // 1) objects list (plain)
        const objectsList = await this.env.generate_inference_output(
          "object_detection",
          inputs,
          detectionsPerInput,
          "objects"
        );
        //console.log(objectsList)
        const objectsForImage = Array.isArray(objectsList)
          ? objectsList[0] || []
          : [];
        totalObjects += objectsForImage.length;

        // 2) bounding-box overlay (single image)
        const bboxImages = await this.env.generate_inference_output(
          "object_detection",
          inputs,
          detectionsPerInput,
          "bounding_boxes"
        );
        const bboxImage = Array.isArray(bboxImages)
          ? bboxImages[0] || null
          : null;
        //console.log(bboxImage)
        flat_bbox.push(bboxImage);
       


        // 3) object crops (array of files)
        const cropLists = await this.env.generate_inference_output(
          "object_detection",
          inputs,
          detectionsPerInput,
          "crop_objects"
        );
        const cropsForImage = Array.isArray(cropLists)
          ? cropLists[0] || []
          : [];
        cropsForImage.map((file) => {flat_crops.push(file);});

        // raw file listing for "download all raw"
        flat_raw.push(rawFile);

        items.push({
          key,
          raw_file: rawFile,
          bbox_image: bboxImages,
          crops: cropsForImage,
          objects: objectsForImage,
        });
      }

      return {
        item_name_list,
        items,
        downloads: {
          raw_files: flat_raw,
          bbox_images: flat_bbox,
          crops: flat_crops,
        },
        summary: {
          total_files: items.length,
          total_bbox_images: flat_bbox.length,
          total_crops: flat_crops.length,
          total_objects: totalObjects,
        },
      };
    } else {
      throw new Error(`generate_outputs: unsupported task_type "${task_type}"`);
    }
  }

  _filename_base(name = "") {
    const dot = name.lastIndexOf(".");
    return dot > 0 ? name.slice(0, dot) : name || "image";
  }

  _safe_label(label = "object") {
    return String(label)
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]+/g, "");
  }
}
