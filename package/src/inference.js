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
  constructor({ env, model_name, model_files = null, model_meta = null, worker = null, run_mode = "main_thread" }) {
    if (!env || !env.tf) throw new Error("env with tf required");
    if (!model_name) throw new Error("model_name required");

    this.env = env;
    this.tf = env.tf;

    this.model_name = model_name;
    this.model_files = model_files;
    this.model = null;
    this.model_meta = model_meta;

    this.input_data_obj = null;     // instance of Data
    this.input_data_map = {};        // { key: { tensor } }
    this.output_data_map = {};       // { key: result }

    this.worker = worker;
    this.run_mode = run_mode;
  }

  /** Load model into memory (main thread only) */
  async load_model() {
    if (this.model) return;

    if (this.model_name === "custom") {
      if (!this.model_files) throw new Error("model_files required for custom model");
      this.model = await this.tf.loadLayersModel(this.model_files);
    } else {
      this.model = await Library.load_model(this.env, this.model_name);
      if (!this.model_meta) {
        this.model_meta = await Library.get_model(this.model_name);
      }
    }
  }

  /** Load a Data object and create tensors */
  async load_data(data_obj) {
    if (!data_obj) throw new Error("Data object required");
    this.input_data_obj = data_obj;

    const model_options = Library.get_model_options(this.model_name, this.model);
    await this.input_data_obj.create_tensors(this.model_name, model_options);

    // Build input_data_map
    this.input_data_map = {};
    for (const key of this.input_data_obj.filelist) {
      this.input_data_map[key] = { tensor: this.input_data_obj.get_item(key).models[this.model_name].tensor };
    }
  }

  /** Run inference */
  async run_model(progress_callback = null) {
    if (!this.input_data_obj) throw new Error("Data not loaded. Call load_data() first.");

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
    const keys = this.input_data_obj.filelist;
    const total = keys.length;

    for (let i = 0; i < total; i++) {
      const key = keys[i];
      const tensor = this.input_data_obj.get_item(key).models[this.model_name].tensor;

      let result;
      if (this.model_name === "tf.coco-ssd") {
        result = await this.model.detect(tensor);
      } else {
        result = this.model.predict(tensor);
      }

      this.input_data_obj.add_results(key, this.model_name, result);
      this.output_data_map[key] = result;

      if (progress_callback) progress_callback(Math.round(((i + 1) / total) * 100));
    }
  }

/** Execute inference in a web worker */
async _run_model_web_worker(progress_callback) {
  if (!this.worker) throw new Error("Worker not initialized");
  if (!this.input_data_obj) throw new Error("No data loaded");

  // Build serialized input map with transferable buffers
  this.input_data_map = {};
  const transferables = [];

  for (const key of this.input_data_obj.filelist) {
    const model_entry = this.input_data_obj.get_item(key).models[this.model_name];
    const tensors = Array.isArray(model_entry.tensor) ? model_entry.tensor : [model_entry.tensor];

    const serialized_tensors = tensors.map(t => {
      if (!(t instanceof this.env.tf.Tensor)) {
        throw new Error("Expected tf.Tensor");
      }
      const buffer = t.dataSync().buffer; // raw ArrayBuffer
      transferables.push(buffer);
      return { buffer, shape: t.shape, dtype: t.dtype };
    });

    this.input_data_map[key] = {
      input_tensor: Array.isArray(model_entry.tensor) ? serialized_tensors : serialized_tensors[0],
      results: model_entry.results || {},
      derived: model_entry.derived || {}
    };
  }

  return new Promise((resolve, reject) => {
    const handle_message = (e) => {
      const { type, percent, output_map, error } = e.data;

      if (type === "progress" && progress_callback) progress_callback(percent);
      else if (type === "done") {
        this.output_data_map = e.data.output_map;
        this.worker.removeEventListener("message", handle_message);
        resolve(this.output_data_map);
      } else if (type === "error") {
        this.worker.removeEventListener("message", handle_message);
        reject(error);
      }
    };

    this.worker.addEventListener("message", handle_message);

    this.worker.postMessage(
      {
        type: "run_inference",
        model_name: this.model_name,
        model_files: this.model_files,
        model_meta: this.model_meta,
        input_map: this.input_data_map,
        basePath: this.env.basePath
      },
      transferables
    );
  });
}



}