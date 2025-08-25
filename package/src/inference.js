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

    this.worker = worker;
    this.run_mode = run_mode;

  }

  /** Load model into memory (main thread only) */
  async load_model() {
    if (this.model) return;

    if (this.model_name === "custom") {
      if (!this.model_files)
        throw new Error("model_files required for custom model");
      this.model = await this.tf.loadLayersModel(this.model_files);
    } else {
      this.model = await Library.load_model(this.env, this.env.basePath,this.model_name);
      if (!this.model_meta) {
        console.log(this.model_name)
        this.model_meta = await Library.get_model(this.model_name);
      }
    }
    console.log("model loaded")
  }

  /** Load a Data object, create tensors, and (if worker mode) serialize them */
  async load_data(data_obj) {
    if (!data_obj) throw new Error("Data object required");
    this.input_data_obj = data_obj;

    // 1) create tensors on the main thread
    const model_options = Library.get_model_options(
      this.model_name,
      this.model
    );
    console.log(model_options)
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
          // OPTION A: zero-copy with offset/length metadata
          this._transferables.push(ta.buffer);
          return {
            buffer: ta.buffer,
            byteOffset: ta.byteOffset, // <-- important
            length: ta.length, // <-- important (elements, not bytes)
            dtype: t.dtype,
            shape: t.shape,
          };

          // OPTION B (simpler, copies once; comment out A if you prefer):
          // const tight = ta.slice(); // new TypedArray with offset 0
          // this._transferables.push(tight.buffer);
          // return {
          //   buffer: tight.buffer,
          //   byteOffset: 0,
          //   length: tight.length,
          //   dtype: t.dtype,
          //   shape: t.shape
          // };
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
  }

  /** Run inference */
  async run_model(progress_callback = null) {
    if (!this.input_data_obj)
      throw new Error("Data not loaded. Call load_data() first.");

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

      // tensors were prepared in load_data() for main thread mode
      const entry = this.input_data_map[key];
      if (!entry || !Array.isArray(entry.tensors)) {
        throw new Error(
          `No tensors found for key "${key}". Did you call load_data()?`
        );
      }
      const tensors = entry.tensors;

      console.log(tensors)
      // run per-tensor
      const perItemOutputs = [];
      if (this.model_name === "tf.coco-ssd" && this.model?.detect) {
        for (const t of tensors) {
          console.log(t)
          const out = await this.model.detect(t);
          perItemOutputs.push(out);
        }
      } else if (this.model?.predict) {
        for (const t of tensors) {
          console.log(t)
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
        const { type, percent, output_map, error } = e.data || {};

        if (type === "progress" && progress_callback) {
          progress_callback(percent);
        } else if (type === "done") {
          this.output_data_map = output_map || {};
          this.worker.removeEventListener("message", handle_message);
          resolve(this.output_data_map);
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

  /** Execute inference in a web worker */
  async _run_model_web_worker1(progress_callback) {
    if (!this.worker) throw new Error("Worker not initialized");
    if (!this.input_data_obj) throw new Error("No data loaded");

    // Build serialized input map with transferable buffers
    this.input_data_map = {};
    const transferables = [];

    for (const key of this.input_data_obj.filelist) {
      const model_entry =
        this.input_data_obj.get_item(key).models[this.model_name];
      const tensors = Array.isArray(model_entry.tensor)
        ? model_entry.tensor
        : [model_entry.tensor];

      const serialized_tensors = tensors.map((t) => {
        if (!(t instanceof this.env.tf.Tensor)) {
          throw new Error("Expected tf.Tensor");
        }
        const buffer = t.dataSync().buffer; // raw ArrayBuffer
        transferables.push(buffer);
        return { buffer, shape: t.shape, dtype: t.dtype };
      });

      this.input_data_map[key] = {
        input_tensor: Array.isArray(model_entry.tensor)
          ? serialized_tensors
          : serialized_tensors[0],
        results: model_entry.results || {},
        derived: model_entry.derived || {},
      };
    }

    return new Promise((resolve, reject) => {
      const handle_message = (e) => {
        const { type, percent, output_map, error } = e.data;

        if (type === "progress" && progress_callback)
          progress_callback(percent);
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
          basePath: this.env.basePath,
        },
        transferables
      );
    });
  }
}
