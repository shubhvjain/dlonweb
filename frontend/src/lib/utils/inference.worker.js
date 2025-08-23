// inference.worker.js
import * as tf from "@tensorflow/tfjs";
import { Library } from 'dlonwebjs';

// Cache loaded models to avoid reloading
const modelCache = {};
let currentTask = null;
let cancelled = false;

/**
 * Convert a plain object back into a tf.Tensor.
 */
function tensorFromObject(obj) {
  if (!obj || typeof obj !== 'object' || !obj.data) {
    throw new Error('Invalid tensor object');
  }
  return tf.tensor(obj.data, obj.shape, obj.dtype);
}

/**
 * Convert a tf.Tensor into a plain transferable object.
 */
async function tensorToObject(tensor) {
  if (!tensor || typeof tensor.data !== 'function') {
    throw new Error('Invalid tensor for conversion');
  }
  const data = await tensor.data();
  return { 
    data: Array.from(data), 
    shape: tensor.shape, 
    dtype: tensor.dtype 
  };
}

/**
 * Process a single input file
 */
async function processInput(name, inputObj, model, modelName, onProgress) {
  if (cancelled) {
    throw new Error('Task cancelled');
  }

  let tensors;
  
  // Handle tensor conversion
  if (Array.isArray(inputObj.input_tensor)) {
    tensors = inputObj.input_tensor.map(t => {
      if (t?.data) return tensorFromObject(t);
      return t;
    });
  } else {
    const tensor = inputObj.input_tensor?.data 
      ? tensorFromObject(inputObj.input_tensor) 
      : inputObj.input_tensor;
    tensors = [tensor];
  }

  // Process each tensor
  const results = [];
  for (let i = 0; i < tensors.length; i++) {
    if (cancelled) {
      // Clean up tensors
      tensors.forEach(t => {
        if (t && typeof t.dispose === 'function') t.dispose();
      });
      throw new Error('Task cancelled');
    }

    const tensor = tensors[i];
    let output;

    try {
      // Run model inference based on model type
      if (modelName === "custom") {
        output = model.predict(tensor);
      } else if (modelName === "tf.coco-ssd") {
        output = await model.detect(tensor);
      } else {
        output = model.predict(tensor);
      }

      // Convert output to transferable format
      if (output instanceof tf.Tensor) {
        const converted = await tensorToObject(output);
        output.dispose(); // Clean up tensor
        results.push(converted);
      } else {
        results.push(output);
      }
    } catch (error) {
      // Clean up on error
      if (tensor && typeof tensor.dispose === 'function') {
        tensor.dispose();
      }
      throw error;
    }
  }

  // Clean up input tensors
  tensors.forEach(t => {
    if (t && typeof t.dispose === 'function') {
      t.dispose();
    }
  });

  return Array.isArray(inputObj.input_tensor) ? results : results[0];
}

// Listen for messages
self.onmessage = async (event) => {
  const { type, payload, id } = event.data;

  try {
    // 1️⃣ INIT → send READY
    if (type === "INIT") {
      cancelled = false;
      self.postMessage({ type: "READY" });
      return;
    }

    // 2️⃣ CANCEL → stop current task
    if (type === "CANCEL") {
      cancelled = true;
      currentTask = null;
      self.postMessage({ 
        type: "ERROR", 
        data: { error: "Task cancelled" }, 
        id 
      });
      return;
    }

    // 3️⃣ RUN_INFERENCE → process inputs
    if (type === "RUN_INFERENCE") {
      currentTask = id;
      cancelled = false;
      
      const { inputFiles, modelName, options, location } = payload;

      if (!inputFiles || !modelName) {
        self.postMessage({
          type: "ERROR",
          data: { error: "Missing required parameters: inputFiles or modelName" },
          id
        });
        return;
      }

      try {
        // Load or reuse model
        if (!modelCache[modelName]) {
          if (modelName === "custom") {
            if (!inputFiles.modelPath && !inputFiles.model) {
              throw new Error("Custom model requires modelPath or model data");
            }
            modelCache[modelName] = await tf.loadLayersModel(inputFiles.modelPath || inputFiles.model);
          } else {
            modelCache[modelName] = await Library.loadModel({ tf }, modelName);
          }
        }

        const model = modelCache[modelName];
        if (!model) {
          throw new Error(`Failed to load model: ${modelName}`);
        }

        const output_data_map = {};
        const inputKeys = Object.keys(inputFiles).filter(key => 
          key !== 'modelPath' && key !== 'model' && inputFiles[key]
        );

        if (inputKeys.length === 0) {
          throw new Error("No valid input files found");
        }

        // Process each input file
        for (let i = 0; i < inputKeys.length; i++) {
          if (cancelled || currentTask !== id) {
            throw new Error("Task cancelled");
          }

          const name = inputKeys[i];
          const inputObj = inputFiles[name];

          if (!inputObj || !inputObj.input_tensor) {
            console.warn(`Skipping invalid input: ${name}`);
            continue;
          }

          try {
            const result = await processInput(name, inputObj, model, modelName);
            
            output_data_map[name] = {
              output_tensor: result,
            };

            // Send progress update
            self.postMessage({
              type: "PROGRESS",
              data: { current: i + 1, total: inputKeys.length },
              id
            });

          } catch (inputError) {
            console.error(`Error processing input ${name}:`, inputError);
            // Continue with other inputs, but log the error
            output_data_map[name] = {
              error: inputError.message,
              output_tensor: null
            };
          }
        }

        // Check if we have any successful results
        const hasResults = Object.values(output_data_map).some(result => 
          result.output_tensor !== null && !result.error
        );

        if (!hasResults) {
          throw new Error("No inputs were successfully processed");
        }

        // Send completion
        self.postMessage({ 
          type: "COMPLETE", 
          data: { result: output_data_map }, 
          id 
        });

      } catch (err) {
        console.error('Inference error:', err);
        self.postMessage({ 
          type: "ERROR", 
          data: { error: err.message }, 
          id 
        });
      } finally {
        if (currentTask === id) {
          currentTask = null;
        }
      }
    }

  } catch (globalError) {
    console.error('Worker global error:', globalError);
    self.postMessage({ 
      type: "ERROR", 
      data: { error: globalError.message || 'Unknown worker error' }, 
      id 
    });
  }
};