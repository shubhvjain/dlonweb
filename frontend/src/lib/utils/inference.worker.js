// inference.worker.js
import * as tf from "@tensorflow/tfjs";
import { Library } from "dlonwebjs"; // adjust path if needed

// Keep a cache of loaded models
const loadedModels = {};

/**
 * Reconstruct a tf.Tensor from a serialized object
 * @param {Object} obj { buffer, shape, dtype }
 * @returns {tf.Tensor}
 */
function deserializeTensor(obj) {
  if (!obj || !obj.buffer || !obj.shape || !obj.dtype)
    throw new Error("Invalid serialized tensor");

  let typedArray;
  switch (obj.dtype) {
    case "float32":
      typedArray = new Float32Array(obj.buffer);
      break;
    case "int32":
      typedArray = new Int32Array(obj.buffer);
      break;
    default:
      throw new Error(`Unsupported dtype: ${obj.dtype}`);
  }

  return tf.tensor(typedArray, obj.shape, obj.dtype);
}

/**
 * Worker message handler
 */
self.onmessage = async (e) => {
  const msg = e.data;

  if (msg.type === "run_inference") {
    const { model_name, model_files, model_meta, input_map, basePath } = msg;

    try {
      // 1️⃣ Load the model if not already loaded
      let model = loadedModels[model_name];
      if (!model) {
        // Provide tf + resolveModelLibraryPath stub
        model = await Library.load_model({tf}, basePath,model_name);
        loadedModels[model_name] = model;
      }

      const keys = Object.keys(input_map);
      const output_map = {};

      // 2️⃣ Run inference per key
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const entry = input_map[key];

        // Reconstruct tensor(s) from serialized buffers
        const tensors = Array.isArray(entry.input_tensor)
          ? entry.input_tensor.map(deserializeTensor)
          : deserializeTensor(entry.input_tensor);

        let output;
        if (model_name === "tf.coco-ssd" && model.detect) {
          output = await model.detect(tensors);
        } else if (model.predict) {
          output = model.predict(tensors);
        } else {
          throw new Error(`Cannot run model: ${model_name}`);
        }

        output_map[key] = {
          output,
          results: entry.results,
          derived: entry.derived
        };

        // 3️⃣ Send progress update
        self.postMessage({
          type: "progress",
          percent: Math.round(((i + 1) / keys.length) * 100)
        });
      }

      // 4️⃣ Send final output
      self.postMessage({ type: "done", output_map });
    } catch (err) {
      self.postMessage({ type: "error", error: err.message || String(err) });
    }
  }
};
