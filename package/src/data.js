// export class Data1 {
//   /**
//    * @param {File|tf.Tensor} input - Input file or tensor
//    * @param {Object} options
//    * @param {Object} options.env - Required env handlers
//    * @param {string} [options.kind] - Optional override for data kind
//    * @param {string} [options.structure] - Optional override: 'simple' | 'complex'
//    * @param {string} [options.environment] - Optional: e.g., 'browser' or 'node'
//    * @param {Object} [options.meta] - Optional metadata from model or source
//    */
//   constructor(input, options = {}) {
//     if (!input) throw new Error("Must provide a file or tensor");

//     if (!options.env || typeof options.env !== "object") {
//       throw new Error("An env object is required with decoding methods");
//     }

    
//     if (!options.env.tf) throw new Error("env.tf is required");

//     this.env = options.env;
//     this.environment = options.environment ||  "unknown";

//     this.input = input;
//     this.kind = options.kind || null;
//     this.structure = options.structure || null;
//     this.meta = options.meta || {};

//     this.tensor = null;
//     this.loaded = false;
//   }

//   _detectKindAndStructure() {
//     const tf = this.env?.tf;
//     const env = this.env;
  
//     if (!env) throw new Error("Missing environment (env)");
  
//     // Tensor or Array of Tensors
//     if (tf && this.input instanceof tf.Tensor) {
//       this.kind = this.kind || "tensor";
//       this.structure = this.structure || "simple";
//       return;
//     }
  
//     if (Array.isArray(this.input) && this.input[0] instanceof tf.Tensor) {
//       this.kind = this.kind || "tensor";
//       this.structure = this.structure || "complex";
//       return;
//     }
  
//     // Ask env for type info (platform-dependent logic centralized there)
//     const typeInfo = env.getInputType?.(this.input);
  
//     if (typeInfo && typeInfo.kind && typeInfo.structure) {
//       this.kind = typeInfo.kind;
//       this.structure = typeInfo.structure;
//       return;
//     }
  
//     throw new Error("Unknown input type: expected Tensor, array of Tensors, or file-like object with recognizable structure");
//   }
  

//   /**
//    * Loads the input into a tensor (or array of tensors)
//    */
//   async load(options = {}) {
//     if (this.loaded) return;
//     this._detectKindAndStructure();
//     if(this.kind=="video"){
//       if(!this.meta.fps){
//         throw new Error("fps value for video not provided")
//       }
//     }
//     this.loaded = true;
//   }

//   /**
//    * Get the tensor or tensors
//    * @returns {tf.Tensor | tf.Tensor[]} tensor or array of tensors
//    */
//   async getTensor(options) {
//     if (!this.loaded) {
//       throw new Error("Data not loaded yet. Call load() first.");
//     }
//     const tf = this.env.tf;
//     if (this.input instanceof tf.Tensor) {
//       this.tensor = this.input;
//     } else {
//       switch (this.kind) {
//         case "image":
//           this.tensor = await this.env.decodeImageToTensor(this.input, options);
//           break;
//         case "video":
//           let opts= {...this.meta,...options}
//           this.tensor = await this.env.decodeVideoToImages(this.input, opts);
//           break;
//         case "tiff":
//           this.tensor = await this.env.decodeTiffToTensors(this.input, options);
//           break;
//         case "text":
//           this.tensor = await this.env.decodeTextToTensor(this.input, options);
//           break;
//         default:
//           throw new Error(`No decoder available for kind "${this.kind}"`);
//       }
//     }
//     return this.tensor;
//   }

//   /**
//    * Optional: Convert back to user-visible Blob (if env supports it)
//    */
//   async toBlob() {
//     if (!this.loaded) throw new Error("Call load() first");
  
//     // === Case 1: Simple non-tensor input ===
//     if (this.structure === "simple" && this.kind !== "tensor") {
//       if (typeof this.env.fileLikeToBlob === "function") {
//         return await this.env.fileLikeToBlob(this.input, this);
//       }
//       throw new Error("env.fileLikeToBlob not implemented for simple non-tensor input");
//     }
  
//     // === Case 2: Tensor input ===
//     if (this.kind === "tensor") {
//       if (typeof this.env.tensorToBlob === "function") {
//         return await this.env.tensorToBlob(this.input, this);
//       }
//       throw new Error("env.tensorToBlob not implemented for tensor input");
//     }
  
//     // === Case 3: Complex structures (like TIFF stacks or video sequences) ===
//     if (this.structure === "complex") {
//       if (typeof this.env.complexToBlob === "function") {
//         return await this.env.complexToBlob(this.input, this);
//       }
//       throw new Error("env.complexToBlob not implemented for complex inputs");
//     }
  
//     throw new Error("Unable to serialize input to blob");
//   }

//     /**
//    * Apply a transformation to the data (currently only supports images).
//    * Delegates the actual transform to the environment handler.
//    * @param {string} type - Transform type, e.g. "bounding_boxes"
//    * @param {Object} options - Transform options
//    * @returns {Promise<Object>} - Result from transform (e.g., updated files)
//    */
//     async transform(type, options = {}) {
//       if (!this.loaded) {
//         throw new Error("Call load() first before transform()");
//       }
  
//       if (typeof this.env.imageTransform !== "function") {
//         throw new Error("env.transform function is required to perform transforms");
//       }
  
//       if (this.kind !== "image") {
//         throw new Error(`Transform not supported for kind "${this.kind}" yet`);
//       }
  
//       // Call the environment-specific transform function with this Data instance
//       const result = await this.env.imageTransform(this.input, type, options);
  
//       // If the transform returned updated file/buffer, update internal state
//       // if (result.file){ 
//       //   this.input = result.file
//       // }
//       // if (result.fileRaw) this.file_raw = result.fileRaw;
  
//       // Optionally update loaded flag or other state if needed
//       // For example, reset loaded=false if transform changes data and requires reload
//       // this.loaded = false;
  
//       return result;
//     }
  
  

// /**
//  * Construct Data from tensor or array of tensors (e.g., model output)
//  * @param {tf.Tensor | tf.Tensor[]} tensorOrTensors
//  * @param {Object} options - includes env, kind, etc.
//  * @returns {Data}
//  */
// static fromTensor(tensorOrTensors, options = {}) {
//   const isArray = Array.isArray(tensorOrTensors);
//   const structure = isArray ? "complex" : "simple";

//   return new Data(tensorOrTensors, {
//     ...options,
//     structure,
//   });
// }
// }



// export class Data2 {
//   /**
//    * @param {Object} envAdapter - abstraction for environment-specific operations (tfjs, browser, node, etc.)
//    * @param {File[]|Array} files - input files
//    * @param {Object} options - preprocessing/global options (e.g., fps for video)
//    */
//   constructor(envAdapter, files = [], options = { fps: 10 }) {
//     this.envAdapter = envAdapter;   // injected environment handler
//     this.files = files;             // raw input files
//     this.filemap = {};              // { filename: { raw_file, tensor, type, metadata, results, derived } }
//     this.filelist = [];             // maintain order of files
//     this.options = options;

//     // Processor registry (can be extended with custom handlers)
//     this.processors = {
//       image: this._processImage.bind(this),
//       video: this._processVideo.bind(this),
//       audio: this._processAudio.bind(this),
//       text: this._processText.bind(this)
//     };
//   }

//   /**
//    * Initialize dataset:
//    * - Detect type for each file
//    * - Build filemap entries with metadata/results placeholders
//    */
//   async load() {
//     this.filemap = {};
//     for (let file of this.files) {
//       const type = this.envAdapter.detectType(file);
//       const key = this.envAdapter.getFileName(file);

//       this.filemap[key] = {
//         raw_file: file,
//         tensor: null,
//         type,
//         metadata: {},
//         results: {},     // store inference results per model/task
//         derived: {}      // store generated crops, masks, overlays, etc.
//       };
//     }
//     this.filelist = Object.keys(this.filemap);
//   }

//   /**
//    * Get one file entry by key
//    * @param {string} key
//    * @returns {Object|null} file entry
//    */
//   get_item(key) {
//     return this.filemap[key] || null;
//   }

//   /**
//    * Convert one item into tensor(s)
//    * @param {string} key filename
//    * @param {object} options preprocessing options (e.g., resize, fps)
//    * @param {object} model_details downstream model info
//    * @returns {Promise<tf.Tensor|Array<tf.Tensor>>}
//    */
//   async get_item_tensor(key, options = {}, model_details = {}) {
//     const entry = this.filemap[key];
//     if (!entry) throw new Error(`File not found: ${key}`);

//     // return cached tensor if exists
//     if (entry.tensor) return entry.tensor;

//     const processor = this._resolveProcessor(entry.type);
//     const tensor = await processor(entry.raw_file, options, model_details);
//     entry.tensor = tensor;
//     return tensor;
//   }

//   /**
//    * Create tensors for all files (in parallel)
//    * @returns {Promise<tf.Tensor[]>}
//    */
//   async create_tensors(options = {}, model_details = {}) {
//     const promises = this.filelist.map(key =>
//       this.get_item_tensor(key, options, model_details)
//     );
//     return Promise.all(promises);
//   }

//   /**
//    * Store inference results for a file under a given task
//    * @param {string} key
//    * @param {string} taskName
//    * @param {*} resultData - usually structured detections, logits, embeddings, etc.
//    */
//   add_results(key, taskName, resultData) {
//     const entry = this.filemap[key];
//     if (!entry) throw new Error(`File not found: ${key}`);
//     entry.results[taskName] = resultData;
//   }

//   /**
//    * Retrieve results for a file + task
//    */
//   get_results(key, taskName) {
//     const entry = this.filemap[key];
//     if (!entry) throw new Error(`File not found: ${key}`);
//     return entry.results[taskName] || null;
//   }

//   /**
//    * Add derived data (like crops, masks, overlays) for a given file and task
//    */
//   add_derived(key, taskName, derivedType, derivedData) {
//     const entry = this.filemap[key];
//     if (!entry) throw new Error(`File not found: ${key}`);
//     if (!entry.derived[taskName]) entry.derived[taskName] = {};
//     if (!entry.derived[taskName][derivedType]) entry.derived[taskName][derivedType] = [];
//     entry.derived[taskName][derivedType].push(derivedData);
//   }

//   /**
//    * Retrieve derived data for a file + task
//    */
//   get_derived(key, taskName, derivedType) {
//     const entry = this.filemap[key];
//     if (!entry) throw new Error(`File not found: ${key}`);
//     return (entry.derived[taskName] && entry.derived[taskName][derivedType]) || null;
//   }

//   /**
//    * Clone dataset but allow injecting new results/derived
//    */
//   clone_with(results = {}, derived = {}) {
//     const clone = new Data(this.envAdapter, this.files, this.options);
//     clone.filemap = JSON.parse(JSON.stringify(this.filemap)); // shallow clone metadata
//     // merge in new results/artifacts
//     for (let [key, entry] of Object.entries(results)) {
//       if (clone.filemap[key]) clone.filemap[key].results = entry;
//     }
//     for (let [key, entry] of Object.entries(derived)) {
//       if (clone.filemap[key]) clone.filemap[key].derived = entry;
//     }
//     clone.filelist = [...this.filelist];
//     return clone;
//   }

//   /**
//    * Export results/derived data in a chosen format
//    * @param {"json"|"tensor"|"raw"} format
//    */
//   export(format = "json") {
//     if (format === "json") {
//       return JSON.stringify(this.filemap, null, 2);
//     }
//     if (format === "tensor") {
//       return this.filelist.map(key => ({
//         key,
//         tensor: this.filemap[key].tensor
//       }));
//     }
//     if (format === "raw") {
//       return this.files;
//     }
//     throw new Error(`Unsupported export format: ${format}`);
//   }

//   // ============= Internal Helpers =============

//   /**
//    * Pick the right processor for a file type
//    */
//   _resolveProcessor(type) {
//     if (!type) throw new Error("Unknown file type");
//     if (type.startsWith("image")) return this.processors.image;
//     if (type.startsWith("video")) return this.processors.video;
//     if (type.startsWith("audio")) return this.processors.audio;
//     if (type.startsWith("text")) return this.processors.text;
//     throw new Error(`No processor for type: ${type}`);
//   }

//   // ============= Built-in Processors =============

//   async _processImage(rawFile, options, model_details) {
//     const rawData = await this.envAdapter.readFile(rawFile);
//     return this.envAdapter.decodeToTensor(rawData, { ...options, type: "image" }, model_details);
//   }

//   async _processVideo(rawFile, options, model_details) {
//     const rawData = await this.envAdapter.readFile(rawFile);
//     return this.envAdapter.decodeToTensor(rawData, { ...options, type: "video" }, model_details);
//   }

//   async _processAudio(rawFile, options, model_details) {
//     const rawData = await this.envAdapter.readFile(rawFile);
//     return this.envAdapter.decodeToTensor(rawData, { ...options, type: "audio" }, model_details);
//   }

//   async _processText(rawFile, options, model_details) {
//     const rawData = await this.envAdapter.readFile(rawFile);
//     return this.envAdapter.decodeToTensor(rawData, { ...options, type: "text" }, model_details);
//   }
// }
/**
 * Data class
 * ----------
 * Represents a collection of files (images, video, audio, text)
 * with support for tensor conversion, result storage, and derived artifacts.
 *
 * Usage:
 *   const data = new Data(envAdapter, [file1, file2]);
 *   await data.load();
 *   const tensors = await data.create_tensors("resnet50");
 */
export class Data {
  /**
   * @param {object} envAdapter - injected environment handler (browser/node)
   * @param {Array<File|Buffer>} files - array of raw input files
   * @param {object} options - default preprocessing options (fps, resize, normalize, etc.)
   */
  constructor(envAdapter, files = [], options = {}) {
    this.envAdapter = envAdapter;
    this.files = files;
    this.options = options;

    this.filemap = {}; // { key: { raw_file, type, metadata, models:{} } }
    this.filelist = [];
  }

  /**
   * Initialize dataset: generate filemap and populate metadata
   */
  async load() {
    this.filemap = {};
    for (let file of this.files) {
      const type = this.envAdapter.detectType(file);
      const key = this.envAdapter.getFileName(file);

      this.filemap[key] = {
        raw_file: file,
        type,
        metadata: {},
        models: {}, // { modelName: { tensor, results, derived } }
      };

    }
    this.filelist = Object.keys(this.filemap);
    this.files = []; // free memory if desired
  }

  /**
   * Get file entry
   */
  get_item(key) {
    return this.filemap[key] || null;
  }

  /**
   * Create or get tensor for a specific model
   * @param {string} key - filename
   * @param {string} modelName - model identifier
   * @param {object} modelOptions - model-specific preprocessing options
   */
  async get_item_tensor(key, modelName, modelOptions = {}) {
    const entry = this.filemap[key];
    if (!entry) throw new Error(`File not found: ${key}`);

    if (!entry.models[modelName]) {
      entry.models[modelName] = { tensor: null, results: {}, derived: {} };
    }

    if (entry.models[modelName].tensor) return entry.models[modelName].tensor;

    // delegate decoding directly to envAdapter
    //const rawData = await this.envAdapter.readFile(entry.raw_file);
    const tensor = await this.envAdapter.decodeToTensor(
      entry.raw_file,
      entry.type,
      { ...this.options, ...modelOptions }
    );

    entry.models[modelName].tensor = tensor;
    return tensor;
  }

  /**
   * Create tensors for all files for a specific model
   */
  async create_tensors(modelName, modelOptions = {}) {
    return Promise.all(
      this.filelist.map((key) =>
        this.get_item_tensor(key, modelName, modelOptions)
      )
    );
  }

  /**
   * Store results for a given file and model
   */
  add_results(key, modelName, resultData) {
    const entry = this.filemap[key];
    if (!entry) throw new Error(`File not found: ${key}`);
    if (!entry.models[modelName]) {
      entry.models[modelName] = { tensor: null, results: {}, derived: {} };
    }
    entry.models[modelName].results = resultData;
  }

  get_results(key, modelName) {
    const entry = this.filemap[key];
    return entry?.models[modelName]?.results || null;
  }

  add_derived(key, modelName, derivedType, derivedData) {
    const entry = this.filemap[key];
    if (!entry) throw new Error(`File not found: ${key}`);
    if (!entry.models[modelName]) {
      entry.models[modelName] = { tensor: null, results: {}, derived: {} };
    }
    if (!entry.models[modelName].derived[derivedType]) {
      entry.models[modelName].derived[derivedType] = [];
    }
    entry.models[modelName].derived[derivedType].push(derivedData);
  }

  get_derived(key, modelName, derivedType) {
    const entry = this.filemap[key];
    return entry?.models[modelName]?.derived[derivedType] || null;
  }
}
