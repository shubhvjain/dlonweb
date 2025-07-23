
import * as cocoSsd from "@tensorflow-models/coco-ssd";

export class Library {
  static data = {
    "projects":{
      "tf":{
        "list":false,
        "title_short":"Tensorflow",
        "website":"https://cocodataset.org",
        "models":{
          "coco-ssd":{
            "active":true,
            "type":"object_detection",
            "model_input":["image"],
            model_input_options:{
              normalize: false,
              addBatchDim: false,
            },
            "model_output":"bounding_boxes",
            "title":"Detect general objects in an image",
            "path":""
          } 
        }
      },
      // "deepd3": {
      //   "list":true,
      //   "title_short": "DeepD3 ",
      //   "title": "DeepD3 (A Deep Learning Framework for Detection of Dendritic Spines and Dendrites)",
      //   "source":"Fernholz, M. H. P., Guggiana Nilo, D. A., Bonhoeffer, T., & Kist, A. M. (2024). DeepD3, an open framework for automated quantification of dendritic spines. In M. H. Hennig (Ed.), PLOS Computational Biology (Vol. 20, Issue 2, p. e1011774). Public Library of Science (PLoS). https://doi.org/10.1371/journal.pcbi.1011774",
      //   "description":"Pre trained models to perform semantic segmentation of dendrites and dendrite spines in microscopy data",
      //   "website": "https://deepd3.forschung.fau.de/",
      //   "model_input": "Microscopy image stack in TIF/TIFF format",
      //   "model_output":"Segmented stack with dendrites and dendritic spines",
      //   "models": {
      //     "8f": {
      //       "title": "Dendritic spine image segmentation for 8 base filters",
      //       "type":"segment_image",
      //       "input_type": "tiff",
      //       "input_help":"",
      //       "output_type": "tiff",
      //       "path": "library/DeepD3_8F"
      //     },
      //     "16f": {
      //       "title": "Dendritic spine image segmentation for 16 base filters",
      //       "input_type": "tiff",
      //       "type":"segment_image",
      //       "path": "library/DeepD3_8F"
      //     },
      //       "32f": {
      //       "title": "Dendritic spine image segmentation for 32 base filters",
      //       "input_type": "tiff",
      //       "type":"segment_image",
      //       "path": "library/DeepD3_8F"
      //     }
      //   }
      // },
      "bagls":{
        "list":true,
        "title_short":"BAGLS",
        "title":"Benchmark for Automatic Glottis Segmentation (BAGLS)",
        "source":"Gómez, P., Kist, A.M., Schlegel, P. et al. BAGLS, a multihospital Benchmark for Automatic Glottis Segmentation. Sci Data 7, 186 (2020). https://doi.org/10.1038/s41597-020-0526-3",
        "description":" ",
        "website":"https://www.bagls.org/",
        "models":{
          "segment":{
            "active":true,
            "type":"object_detection",
            "model_input":["image","video"],
            model_input_options:{
              //resize: [256, 256],  
              normalize: true,
              addBatchDim: true,
              //dtype: 'float32'
            },
            "model_output":"image_segmentation",
            "title":"Glottis Segmentation on Endoscopy data",
            "path":"library/bagls_rgb",
            "type":"segment_image",
          },
          // "new":{
          //   "title":"Segment Endoscopic Image using BAGLS v2",
          //   "path":"library/bagls_new",
          //   "type":"segment_image",
          // }
        }
      }
    }
  }

  static async loadData() {
    // if (!this.data) {
    //   const response = await fetch('models.json');
    //   if (!response.ok) throw new Error('Failed to load model.json');
    //   this.data = await response.json();
    // }
    return this.data;
  }

  static async get_model_list() {
    const data = await this.loadData();
    const result = [];
    for (const [projectKey, project] of Object.entries(data.projects)) {
      if (!project.models) continue;
      for (const [modelKey,model] of Object.entries(project.models)) {
        const label = `${model.title} (${projectKey}.${modelKey})`;
        const value = `${projectKey}.${modelKey}`;
        result.push({ label, value, type : model.type });
      }
    }
    return result;
  }

  static async get_model(...args) {
    const data = await this.loadData();
    let projectKey, modelKey;

    if (args.length === 1) {
      [projectKey, modelKey] = args[0].split('.');
    } else if (args.length === 2) {
      [projectKey, modelKey] = args;
    } else {
      throw new Error('Invalid arguments');
    }

    const project = data.projects[projectKey];
    if (!project || !project.models || !project.models[modelKey]) return null;

    return project.models[modelKey] || null;
  }

    /**
   * Load a model either via `coco-ssd` or using `env.tf.loadLayersModel`
   * @param {object} env - injected environment with at least tf
   * @param {string} modelKey - full key like "tf.coco-ssd"
   */
    static async loadModel(env, modelKey) {
      if (!env || !env.tf) throw new Error("env with tf required");
      if(!env.resolveModelLibraryPath){throw new Error("env with resolveModelLibraryPath required")}
      const modelInfo = await this.get_model(modelKey);
      
      if (!modelInfo) throw new Error(`Model not found: ${modelKey}`);
  
      if (modelKey === "tf.coco-ssd") {
        return await cocoSsd.load();
      }
      if (modelInfo.path) {
        const basePath = env.resolveModelLibraryPath()
        console.log(basePath)
        const modelUrl = `${basePath}${modelInfo.path}/model.json`; // customize base path if needed
        return await env.tf.loadLayersModel(modelUrl);
      }
  
      throw new Error(`No valid loader for model: ${modelKey}`);
    }

    static getModelOptions(modelName, model) {
      if (modelName === "tf.coco-ssd") {
        return {
          inputShape: [1, -1,-1, 3],  // batch size 1, 
          dtype: 'int32',                // coco-ssd expects int32 pixels
          normalize: false,              // no normalization for coco-ssd
          addBatchDim: false             // inputs already include batch dim
        };
      }
    
      // Generic inference for other models
      if (model && model.inputs && model.inputs.length > 0) {
        const inputTensor = model.inputs[0];
        const inputShape = inputTensor.shape.map(dim => (dim === null ? 1 : dim));
        const dtype = inputTensor.dtype || 'float32';
    
        // Usually, model inputs include batch dim as the first dimension
        // We'll check if the first dimension is 1 (batch size)
        // But in general, inputShape length includes batch dim
    
        // So to determine if you need to add batch dim:
        // If model expects rank 4 (e.g. [batch, h, w, c])
        // but inputShape first dimension is 1, then input tensor should have batch dim
        // The question is: do you have an input tensor without batch dim? 
        // We can't detect that here, but we return a flag indicating model expects batch dim.
    
        // So addBatchDim = true if model input shape length > 3
        const addBatchDim = inputShape.length > 3;
    
        const normalize = (dtype === 'float32');
    
        return {
          inputShape,
          dtype,
          normalize,
          addBatchDim
        };
      }
    
      // fallback default
      return {
        inputShape: [1, 224, 224, 3],
        dtype: 'float32',
        normalize: true,
        addBatchDim: true
      };
    }

}