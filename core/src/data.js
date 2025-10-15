/**
 * Data Class
 * ==========
 * Handles a collection of input files (images, videos, text, tensors) and manages:
 * - Preprocessing (frame extraction, validation)
 * - Tensor conversion with per-model customization
 * - Storage of model results and derived artifacts
 * - Timing of preprocessing and tensor creation
 *
 * @example
 * ```js
 * // Initialize with adapter and files
 * const data = new Data(adapter, [file1, file2], { fps: 10 });
 *
 * // Load and preprocess files
 * await data.load();
 *
 * // Create tensors for a specific model
 * await data.create_tensors('tf.coco-ssd', modelOptions);
 *
 * // Store inference results
 * data.add_results('image.jpg', 'tf.coco-ssd', detections);
 * ```
 *
 * @requires Adapter Interface:
 * The `envAdapter` must implement the following methods:
 * - `detectType(file): 'image' | 'video' | 'text' | 'tensor'`
 *   Determines file type.
 * - `getFileName(file): string`
 *   Returns the filename for identification.
 * - `processFile(file, options): Promise<Array<File|Buffer>>`
 *   Preprocesses the file (e.g., extracts frames from video).
 * - `decodeToTensor(data, type, options): Promise<Tensor|Array<Tensor>>`
 *   Converts preprocessed data into tensor(s).
 *
 * @structure filemap:
 * ```js
 * {
 *   "filename.jpg": {
 *     raw_file: File,                    // Original file object
 *     input: [File],                     // Preprocessed artifacts
 *     type: "image",                     // Detected file type
 *     metadata: {},                      // Custom metadata
 *     timings: {                         // Performance metrics
 *       preprocessing: 240,              // Time in ms
 *       tensor_creation: 160
 *     },
 *     models: {                          // Per-model data
 *       "tf.coco-ssd": {
 *         tensor: [Tensor],              // Created tensors
 *         results: [...],                // Inference outputs
 *         derived: {                     // Optional derived artifacts
 *           crops: [File, File]
 *         }
 *       }
 *     }
 *   }
 * }
 * ```
 */
export class Data {
  /**
   * Create a Data instance.
   *
   * @param {Object} envAdapter - Environment adapter (browser or Node).
   * Must implement the following methods:
   *   - `detectType(file): 'image' | 'video' | 'text' | 'tensor'` — determines the file type.
   *   - `getFileName(file): string` — extracts filename from the file object.
   *   - `processFile(file, options): Promise<Array<File|Buffer>>` — preprocesses a file (e.g., extract video frames).
   *   - `decodeToTensor(data, type, options): Promise<Tensor|Array<Tensor>>` — converts preprocessed data to tensor(s).
   *
   * @param {Array<File|Buffer>} [files=[]] - Raw input files to process.
   * @param {Object} [options={}] - Preprocessing options.
   * @param {number} [options.fps=10] - Frames per second for video extraction.
   */
  constructor(envAdapter, files = [], options = {}) {
    this.envAdapter = envAdapter;
    this.files = files;
    this.options = options;

    this.filemap = {}; // this store all file related data
    this.filelist = []; // a list of file names for easy access
  }

  /**
   * Initialize dataset: generate filemap and populate metadata
   */
  async load() {
    this.filemap = {};

    const startFile = Date.now();

    for (let file of this.files) {
      const startFile = Date.now();
      const type = this.envAdapter.detectType(file);
      const key = this.envAdapter.getFileName(file);

      this.filemap[key] = {
        raw_file: file, //  keep original file
        input: [], // processed artifacts (always array)
        type,
        metadata: {},
        models: {},
        timings: {
          preprocessing: 0,
          tensor_creation: 0,
        },
      };

      // run preprocessing via env
      const processed = await this.envAdapter.processFile(file, {
        type,
        ...this.options,
      });
      this.filemap[key].input = processed || [];
      // save the time taken to preprocess this file
      this.filemap[key].timings.preprocessing = Date.now() - startFile;
    }

    this.filelist = Object.keys(this.filemap);
    this.files = []; // free memory
  }

  /**
   * Get file entry. Give a file name key, returns the filemap object for that file
   */
  get_item(key) {
    return this.filemap[key] || null;
  }

   /**
   * Create or retrieve tensors for a specific file and model
   * 
   * Tensors are cached per model. Subsequent calls return the cached tensor array.
   * 
   * @async
   * @param {string} key - Filename
   * @param {string} modelName - Model identifier (e.g., 'tf.coco-ssd'). This need not be a library model. but something externally managed by the called. 
   * @param {Object} modelOptions - Model-specific preprocessing options
   * @param {Array<number>} [modelOptions.inputShape] - Expected input shape [batch, h, w, c]
   * @param {string} [modelOptions.dtype='float32'] - Tensor data type
   * @param {boolean} [modelOptions.addBatchDim=false] - Add batch dimension
   * @returns {Promise<Array<tf.Tensor>>} Array of tensors 
   * @throws {Error} If file not found or tensor creation fails
   */
  async get_item_tensor(key, modelName, modelOptions = {}) {
    const entry = this.filemap[key];
    if (!entry) throw new Error(`File not found: ${key}`);

    if (!entry.models[modelName]) {
      entry.models[modelName] = { tensor: null, results: {}, derived: {} };
    }

    // Return cached tensor
    if (entry.models[modelName].tensor) return entry.models[modelName].tensor;

    // Track tensor creation time
    const startTime = Date.now();

    // Convert preprocessed input array to tensors
    const tensor_array = await this.envAdapter.decodeToTensor(
      entry.input,
      entry.type,
      { ...this.options, ...modelOptions }
    );
    
    entry.models[modelName].tensor = tensor_array;
    entry.timings.tensor_creation = Date.now() - startTime;
    return tensor_array;
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
  add_results(key, modelName, resultData,timingData=0) {
    const entry = this.filemap[key];
    if (!entry) throw new Error(`File not found: ${key}`);
    if (!entry.models[modelName]) {
      entry.models[modelName] = { tensor: null, results: {}, derived: {}, timing:0 };
    }
    entry.models[modelName].results = resultData;
    // not the best place to store the timings but will work for now 
    entry.models[modelName].timing = timingData;
    
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
