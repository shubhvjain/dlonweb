import { Data } from './data.js';
import { Library } from './models.js';

export class InferenceTask {
  /**
   * @param {Object} options
   * @param {Object} options.env - env object with tf, decode helpers
   * @param {string} options.model - either "custom" or a library model key (like "coco-ssd")
   * @param {string|Object} [options.modelFiles] - if custom, path or model files (JSON + weights)
   * @param {string} [options.modelName] - optional, for library model key (e.g., "tf.coco-ssd")
   */
  constructor({ env, modelFiles, modelName, modelMeta ,environment}) {
    if (!env || !env.tf) throw new Error('env with tf required');
    if (!modelName) throw new Error('modelName is required');
    this.environment = environment ||  "unknown";
    this.env = env;
    this.tf = env.tf;
    this.modelFiles = modelFiles || null;
    this.modelName = modelName || null;
    this.model = null;
    this.modelMeta = modelMeta || { "model_input":"image","model_input_options":{},"model_output":"bounding_boxes"}
  }


  async loadModel() {
    if (this.model) return;

    if (this.modelName === 'custom') {
      if (!this.modelFiles) {
        throw new Error('modelFiles must be provided for custom models');
      }
      if (typeof this.modelFiles === 'string') {
        this.model = await this.tf.loadLayersModel(this.modelFiles);
      } else {
        this.model = await this.tf.loadLayersModel(this.modelFiles);
      }
    } else {
      // Use Library method for built-in models
      this.model = await Library.loadModel(this.env, this.modelName);
      this.modelMeta = await Library.get_model(this.modelName)
    }
  }

  /**
   * Run inference on input (Data instance or raw input).
   * @param {Data|any} input
   * @param {Object} options passed to Data.load()
   * @returns {Promise<Data|Data[]>} output wrapped in Data instance(s)
   */
  async runInference(input, options = {}) {
    if (!this.model) await this.loadModel();

    if(!input instanceof Data){
      throw new Error("Invalid input type. Must be an instance of Data")
    }
  
    //const data = input instanceof Data ? input : new Data(input, { env: this.env });
    //await data.load(options);

    let tensor_options = { ...this.modelMeta?.model_input_options }


    const tensorInput = await input.getTensor(tensor_options);
  
    let output;
  
    if (this.modelName === 'custom') {
      // Custom tf.LayersModel uses predict()
      output = this.model.predict(tensorInput);
    } else if (this.modelName === "tf.coco-ssd") {

      if (!this.modelMeta["model_input"].includes(input.kind) ){
        throw new Error("Unsupported input type")
      }
      // If tensorInput is a tensor, pass it directly; otherwise, adapt as needed.
      output = await this.model.detect(tensorInput);
      // output needs to be processed to generate Data 
    } else {
      // For other library models (assumed to be tf.LayersModel)
      output = this.model.predict(tensorInput);
    }

    console.log(output)
    // generate the actual output based on model output 
    if(this.modelMeta["model_output"]=="bounding_boxes"){
        let transformed_data  = await input.transform("add_bounding_boxes",{boxes:output})
        console.log(transformed_data)
        let output_image = new Data(transformed_data.file, { environment: this.environment, env: this.env });
        await output_image.load(options);
        console.log(output_image)
        console.log("-----")
        return output_image
    }else{
      return output
    }

  
    // if (Array.isArray(output)) {
    //   // Wrap each tensor output as Data
    //   return output.map(t => Data.fromTensor(t, { env: this.env, kind: 'tensor', structure: 'simple' }));
    // } else if (output instanceof this.tf.Tensor) {
    //   return Data.fromTensor(output, { env: this.env, kind: 'tensor', structure: 'simple' });
    // } else {
    //   // For coco-ssd detect output which is an array of objects (detections), wrap it in Data or return raw
    //   return output;
    // }
  }
}
