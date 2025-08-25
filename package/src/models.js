import * as cocoSsd from "@tensorflow-models/coco-ssd";

export class Library {
  /**
   * Static metadata registry for available projects/models.
   * Can be extended or replaced by external JSON config.
   */
  static data = {
    projects: {
      tf: {
        list: false,
        title_short: "Tensorflow",
        website: "https://cocodataset.org",
        models: {
          "coco-ssd": {
            active: true,
            type: "object_detection",
            model_input: ["image"],
            model_input_options: {
              normalize: false,
              addBatchDim: false,
            },
            model_output: "bounding_boxes",
            title: {
              en: "Detect objects in images",
              de: "Objekte in Bildern erkennen",
            },
            description: {
              en: "Upload an image and the model will highlight and label common objects such as people, cars, or animals. Input: JPG/PNG image. Output: Detected objects with bounding boxes.",
              de: "Laden Sie ein Bild hoch, und das Modell markiert und benennt gängige Objekte wie Personen, Autos oder Tiere. Eingabe: JPG/PNG-Bild. Ausgabe: Erkannte Objekte mit Begrenzungsrahmen.",
            },
            path: "",
          },
        },
      },

      bagls: {
        list: true,
        title_short: "BAGLS",
        title: "Benchmark for Automatic Glottis Segmentation (BAGLS)",
        website: "https://www.bagls.org/",
        models: {
          segment: {
            active: true,
            type: "segment_image",
            model_input: ["image", "video"],
            model_input_options: {
              inputShape: [1, 256, 256, 3],
              dtype: "float32",
              normalize: true,
              addBatchDim: true,
              targetHeight:256,
              targetWidth: 256
            },
            model_output: "image_segmentation",
            title: {
              en: "Segment glottis in endoscopy data",
              de: "Glottis in Endoskopie-Daten segmentieren",
            },
            description: {
              en: "Upload endoscopy images or videos and the model will automatically outline the glottis region. Input: Image/Video. Output: Segmentation mask showing glottis area.",
              de: "Laden Sie Endoskopie-Bilder oder -Videos hoch, und das Modell markiert automatisch den Glottisbereich. Eingabe: Bild/Video. Ausgabe: Segmentierungsmaske mit Glottisbereich.",
            },
            path: "library/bagls_rgb",
          },
        },
      },
    },
  };

  /**
   * Load static or remote model registry.
   */
  static  load_data() {
    // Future: replace with fetch if external registry is needed
    return this.data;
  }

  /**
   * Return a flattened list of all models across projects.
   * Useful for building dropdowns or UIs.
   */
  static async get_model_list() {
    const data =  this.load_data();
    const result = [];

    for (const [projectKey, project] of Object.entries(data.projects)) {
      if (!project.models) continue;
      for (const [modelKey, model] of Object.entries(project.models)) {
        result.push({
          label: model.title,
          value: `${projectKey}.${modelKey}`,
          type: model.type,
          description: model.description,
        });
      }
    }
    return result;
  }

  /**
   * Get a model definition object by project/model key.
   * @param {string|array} args - "project.model" or [project, model]
   */
  static async get_model(...args) {
    const data =  this.load_data();
    let projectKey, modelKey;
    console.log(args)
    if (args.length === 1) {
      [projectKey, modelKey] = args[0].split(".");
    } else if (args.length === 2) {
      [projectKey, modelKey] = args;
    } else {
      throw new Error("Invalid arguments: must be 'project.model' or [project, model]");
    }

    const project = data.projects[projectKey];
    if (!project || !project.models || !project.models[modelKey]) return null;

    return project.models[modelKey] || null;
  }

  /**
   * Load a TensorFlow.js model.
   * Supports both prepackaged models (like coco-ssd) and custom paths.
   * @param {object} env - injected environment with tf + path resolver
   * @param {string} modelKey - full key like "tf.coco-ssd"
   */
  static async load_model(env,basePath, modelKey) {
    if (!env || !env.tf) throw new Error("env with tf required");
   
    const modelInfo = await this.get_model(modelKey);
    if (!modelInfo) throw new Error(`Model not found: ${modelKey}`);

    // Special case for prebuilt models
    if (modelKey === "tf.coco-ssd") {
      return await cocoSsd.load();
    }

    // Otherwise use standard tf.loadLayersModel
    if (modelInfo.path) {
     // const basePath = env.resolveModelLibraryPath();
      const modelUrl = `${basePath}${modelInfo.path}/model.json`;
      return await env.tf.loadLayersModel(modelUrl);
    }

    throw new Error(`No valid loader for model: ${modelKey}`);
  }

  /**
   * Get canonical input options for a model.
   * Used to normalize data preparation across different models.
   * Returns only standard fields: { inputShape, dtype, normalize, addBatchDim }
   */
static  get_model_options(modelName, model = null) {
  // Special-case: coco-ssd (dynamic H/W, no batch, no normalize, int32)
  if (modelName === "tf.coco-ssd") {
    return {
      inputShape: [1, -1, -1, 3],
      dtype: "int32",
      normalize: false,
      addBatchDim: false,
    };
  }

  const defaults = {
    inputShape: [1, 224, 224, 3],
    dtype: "float32",
    normalize: true,
    addBatchDim: true,
  };

  // 1) Registry (if available)
  const data =  this.load_data();
  const [projectKey, modelKey] = (modelName || "").split(".");
  if (!projectKey || !modelKey) throw new Error("invalid model name (expected 'project.model')");
  const reg = data?.projects?.[projectKey]?.models?.[modelKey];

  const fromRegistry = {};
  if (reg?.model_input_options) {
    const mio = reg.model_input_options;
    if (mio.inputShape) fromRegistry.inputShape = mio.inputShape;
    if (mio.dtype) fromRegistry.dtype = mio.dtype;
    if (typeof mio.normalize !== "undefined") fromRegistry.normalize = mio.normalize;
    if (typeof mio.addBatchDim !== "undefined") fromRegistry.addBatchDim = mio.addBatchDim;
  }

  // 2) Inference from loaded model (optional)
  const fromModel = {};
  if (model && Array.isArray(model.inputs) && model.inputs.length) {
    const t = model.inputs[0];
    const shape = (t.shape || []).map((d, i) => (d == null || d < 0 ? (i === 0 ? 1 : -1) : d));
    if (shape.length) fromModel.inputShape = shape;
    if (t.dtype) fromModel.dtype = t.dtype;
    // Heuristic: 4D input -> batch dim likely present
    if (shape.length) fromModel.addBatchDim = shape.length > 3;
    // Keep normalize default unless registry overrides it
  }

  // 3) Merge: defaults < fromModel < fromRegistry
  const merged = { ...defaults, ...fromModel, ...fromRegistry };

  // 4) Sanitize shape to 4D and batch dim if requested
  let s = merged.inputShape;
  if (Array.isArray(s)) {
    if (s.length === 3 && merged.addBatchDim) s = [1, ...s];
    if (s.length === 4) {
      // Ensure batch is concrete (1), keep H/W dynamic if unknown
      s = s.map((d, i) => (d == null || d < 0 ? (i === 0 ? 1 : -1) : d));
    }
    merged.inputShape = s;
  } else {
    merged.inputShape = defaults.inputShape;
  }

  // 5) Return only standard keys
  const { inputShape, dtype, normalize, addBatchDim } = merged;
  return { inputShape, dtype, normalize, addBatchDim };
}

  
}
