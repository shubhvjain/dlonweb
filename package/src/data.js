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
        raw_file: file,       // always keep original
        input: [],            // processed artifacts (always array)
        type,
        metadata: {},
        models: {}
      };
  
      // run preprocessing via env
      const processed = await this.envAdapter.processFile(file, { type, ...this.options });
      this.filemap[key].input = processed || [];
    }
  
    this.filelist = Object.keys(this.filemap);
    this.files = []; // free memory 
  }

  /**
   * Get file entry
   */
  get_item(key) {
    return this.filemap[key] || null;
  }


/**
 * Create or get tensor(s) for a specific model
 * @param {string} key - filename
 * @param {string} modelName - model identifier
 * @param {object} modelOptions - model-specific preprocessing options
 * @returns {Promise<tf.Tensor[]>} always returns an array of tensors
 */
  async get_item_tensor(key, modelName, modelOptions = {}) {
    const entry = this.filemap[key];
    if (!entry) throw new Error(`File not found: ${key}`);

    if (!entry.models[modelName]) {
      entry.models[modelName] = { tensor: null, results: {}, derived: {} };
    }

    // Return cached tensor
    if (entry.models[modelName].tensor) return entry.models[modelName].tensor;

    // Convert preprocessed input array to tensors
    const tensor_array = await this.envAdapter.decodeToTensor(entry.input, entry.type, { ...this.options, ...modelOptions });

    entry.models[modelName].tensor = tensor_array;
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
