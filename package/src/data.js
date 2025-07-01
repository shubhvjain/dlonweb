export class Data {
  /**
   * @param {File|tf.Tensor} input - Input file or tensor
   * @param {Object} options
   * @param {Object} options.env - Required env handlers
   * @param {string} [options.kind] - Optional override for data kind
   * @param {string} [options.structure] - Optional override: 'simple' | 'complex'
   * @param {string} [options.environment] - Optional: e.g., 'browser' or 'node'
   * @param {Object} [options.meta] - Optional metadata from model or source
   */
  constructor(input, options = {}) {
    if (!input) throw new Error("Must provide a file or tensor");

    if (!options.env || typeof options.env !== "object") {
      throw new Error("An env object is required with decoding methods");
    }

    if (!options.env.tf) throw new Error("env.tf is required");

    this.env = options.env;
    this.environment = options.environment ||  "unknown";

    this.input = input;
    this.kind = options.kind || null;
    this.structure = options.structure || null;
    this.meta = options.meta || {};

    this.tensor = null;
    this.loaded = false;
  }

  _detectKindAndStructure() {
    const tf = this.env?.tf;
    const env = this.env;
  
    if (!env) throw new Error("Missing environment (env)");
  
    // Tensor or Array of Tensors
    if (tf && this.input instanceof tf.Tensor) {
      this.kind = this.kind || "tensor";
      this.structure = this.structure || "simple";
      return;
    }
  
    if (Array.isArray(this.input) && this.input[0] instanceof tf.Tensor) {
      this.kind = this.kind || "tensor";
      this.structure = this.structure || "complex";
      return;
    }
  
    // Ask env for type info (platform-dependent logic centralized there)
    const typeInfo = env.getInputType?.(this.input);
  
    if (typeInfo && typeInfo.kind && typeInfo.structure) {
      this.kind = typeInfo.kind;
      this.structure = typeInfo.structure;
      return;
    }
  
    throw new Error("Unknown input type: expected Tensor, array of Tensors, or file-like object with recognizable structure");
  }
  

  /**
   * Loads the input into a tensor (or array of tensors)
   */
  async load(options = {}) {
    if (this.loaded) return;
    this._detectKindAndStructure();
    this.loaded = true;
  }

  /**
   * Get the tensor or tensors
   * @returns {tf.Tensor | tf.Tensor[]} tensor or array of tensors
   */
  async getTensor(options) {
    if (!this.loaded) {
      throw new Error("Data not loaded yet. Call load() first.");
    }
    const tf = this.env.tf;
    if (this.input instanceof tf.Tensor) {
      this.tensor = this.input;
    } else {
      switch (this.kind) {
        case "image":
          this.tensor = await this.env.decodeImageToTensor(this.input, options);
          break;
        case "video":
          this.tensor = await this.env.decodeVideoToImages(this.input, options);
          break;
        case "tiff":
          this.tensor = await this.env.decodeTiffToTensors(this.input, options);
          break;
        case "text":
          this.tensor = await this.env.decodeTextToTensor(this.input, options);
          break;
        default:
          throw new Error(`No decoder available for kind "${this.kind}"`);
      }
    }
    return this.tensor;
  }

  /**
   * Optional: Convert back to user-visible Blob (if env supports it)
   */
  async toBlob() {
    if (!this.loaded) throw new Error("Call load() first");
  
    // === Case 1: Simple non-tensor input ===
    if (this.structure === "simple" && this.kind !== "tensor") {
      if (typeof this.env.fileLikeToBlob === "function") {
        return await this.env.fileLikeToBlob(this.input, this);
      }
      throw new Error("env.fileLikeToBlob not implemented for simple non-tensor input");
    }
  
    // === Case 2: Tensor input ===
    if (this.kind === "tensor") {
      if (typeof this.env.tensorToBlob === "function") {
        return await this.env.tensorToBlob(this.input, this);
      }
      throw new Error("env.tensorToBlob not implemented for tensor input");
    }
  
    // === Case 3: Complex structures (like TIFF stacks or video sequences) ===
    if (this.structure === "complex") {
      if (typeof this.env.complexToBlob === "function") {
        return await this.env.complexToBlob(this.input, this);
      }
      throw new Error("env.complexToBlob not implemented for complex inputs");
    }
  
    throw new Error("Unable to serialize input to blob");
  }

    /**
   * Apply a transformation to the data (currently only supports images).
   * Delegates the actual transform to the environment handler.
   * @param {string} type - Transform type, e.g. "bounding_boxes"
   * @param {Object} options - Transform options
   * @returns {Promise<Object>} - Result from transform (e.g., updated files)
   */
    async transform(type, options = {}) {
      if (!this.loaded) {
        throw new Error("Call load() first before transform()");
      }
  
      if (typeof this.env.imageTransform !== "function") {
        throw new Error("env.transform function is required to perform transforms");
      }
  
      if (this.kind !== "image") {
        throw new Error(`Transform not supported for kind "${this.kind}" yet`);
      }
  
      // Call the environment-specific transform function with this Data instance
      const result = await this.env.imageTransform(this.input, type, options);
  
      // If the transform returned updated file/buffer, update internal state
      // if (result.file){ 
      //   this.input = result.file
      // }
      // if (result.fileRaw) this.file_raw = result.fileRaw;
  
      // Optionally update loaded flag or other state if needed
      // For example, reset loaded=false if transform changes data and requires reload
      // this.loaded = false;
  
      return result;
    }
  
  

/**
 * Construct Data from tensor or array of tensors (e.g., model output)
 * @param {tf.Tensor | tf.Tensor[]} tensorOrTensors
 * @param {Object} options - includes env, kind, etc.
 * @returns {Data}
 */
static fromTensor(tensorOrTensors, options = {}) {
  const isArray = Array.isArray(tensorOrTensors);
  const structure = isArray ? "complex" : "simple";

  return new Data(tensorOrTensors, {
    ...options,
    structure,
  });
}
}
