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
  static async load_data() {
    // Future: replace with fetch if external registry is needed
    return this.data;
  }

  /**
   * Return a flattened list of all models across projects.
   * Useful for building dropdowns or UIs.
   */
  static async get_model_list() {
    const data = await this.load_data();
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
    const data = await this.load_data();
    let projectKey, modelKey;

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
   */
  static get_model_options(modelName, model) {
    if (modelName === "tf.coco-ssd") {
      return {
        inputShape: [1, -1, -1, 3], // batch size 1
        dtype: "int32",             // coco-ssd expects int32
        normalize: false,
        addBatchDim: false,
      };
    }

    // Generic case for TF.js LayersModel
    if (model && model.inputs && model.inputs.length > 0) {
      const inputTensor = model.inputs[0];
      const inputShape = inputTensor.shape.map((dim) => (dim === null ? 1 : dim));
      const dtype = inputTensor.dtype || "float32";
      const addBatchDim = inputShape.length > 3;
      const normalize = dtype === "float32";

      return { inputShape, dtype, normalize, addBatchDim };
    }

    // Fallback default
    return {
      inputShape: [1, 224, 224, 3],
      dtype: "float32",
      normalize: true,
      addBatchDim: true,
    };
  }
}
