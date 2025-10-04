// inference.worker.js
import * as tf from '@tensorflow/tfjs';
import { Library } from '../../../../core/dist/index.mjs'; // adjust path if needed

// cache loaded models by name
const loadedModels = {};

/** Reconstruct a tf.Tensor from a serialized object { buffer, shape, dtype } */
function deserializeTensor(obj) {
  if (!obj || !obj.buffer || !obj.shape || !obj.dtype) {
    throw new Error("Invalid serialized tensor");
  }
  const offset = obj.byteOffset || 0;
  const length = obj.length; // number of elements

  let typed;
  switch (obj.dtype) {
    case "float32":
      typed = (typeof length === "number")
        ? new Float32Array(obj.buffer, offset, length)
        : new Float32Array(obj.buffer);
      break;
    case "int32":
      typed = (typeof length === "number")
        ? new Int32Array(obj.buffer, offset, length)
        : new Int32Array(obj.buffer);
      break;
    case "bool":
      typed = (typeof length === "number")
        ? new Uint8Array(obj.buffer, offset, length)
        : new Uint8Array(obj.buffer);
      break;
    default:
      throw new Error(`Unsupported dtype: ${obj.dtype}`);
  }

  return tf.tensor(typed, obj.shape, obj.dtype);
}


/** Serialize possible outputs so they can be structured-cloned */
async function serializeOutput(out) {
  if (out == null) return out;

  // tensor → plain object with buffer/shape/dtype
  if (out instanceof tf.Tensor) {
    const data = await out.data(); // 
    return {
      __tensor__: true,
      buffer: data.buffer,
      byteOffset: data.byteOffset,
      length: data.length,
      shape: out.shape,
      dtype: out.dtype
    };
  }

  // array → serialize each element
  if (Array.isArray(out)) {
    return Promise.all(out.map(serializeOutput)); // Handle async recursively
  }

  // plain object / number / string - pass through
  if (
    typeof out === 'object' ||
    typeof out === 'number' ||
    typeof out === 'string' ||
    typeof out === 'boolean'
  ) {
    return out;
  }

  // fallback: stringify
  try {
    return JSON.parse(JSON.stringify(out));
  } catch {
    return String(out);
  }
}

self.onmessage = async (e) => {
	const msg = e.data;
	if (msg?.type !== 'run_inference') return;

	const { model_name, model_files, model_meta, input_map, basePath } = msg;

	try {
		let start_time = Date.now()
		// 1) load model if needed
		let model = loadedModels[model_name];
		if (!model) {
			// env stub: only tf
			model = await Library.load_model({ tf }, basePath, model_name);
			loadedModels[model_name] = model;
		}

		// 2) iterate over items
		const keys = Object.keys(input_map || {});
		const output_map = {};

		for (let i = 0; i < keys.length; i++) {
			const key = keys[i];
			const entry = input_map[key];

			// ALWAYS array of serialized tensors per your InferenceTask.load_data
			const serializedList = entry.input_tensor || [];
			const tensors = serializedList.map(deserializeTensor);

			const perItemOutputs = [];

			if (model_name === 'tf.coco-ssd' && typeof model.detect === 'function') {
				// run detect per tensor (coco-ssd expects an image tensor)
				for (const t of tensors) {
					const out = await model.detect(t);
					perItemOutputs.push(await serializeOutput(out)); // out is plain objects already, but safe to serialize
					t.dispose?.();
				}
			} else if (typeof model.predict === 'function') {
				// generic model: predict per tensor (avoid batching ambiguity)
				for (const t of tensors) {
					const out = model.predict(t);
					// out can be a tensor, array of tensors, or plain objects
					perItemOutputs.push(await serializeOutput(out));
					t.dispose?.();
				}
			} else {
				throw new Error(`Cannot run model "${model_name}": no detect() or predict().`);
			}

			// store only the outputs array (mirrors main-thread path)
			output_map[key] = perItemOutputs;

			// 3) progress update
			self.postMessage({
				type: 'progress',
				percent: Math.round(((i + 1) / keys.length) * 100)
			});
		}
		let end_time =  Date.now()
		let run_time = end_time- start_time
		// 4) done
		self.postMessage({ type: 'done', output_map,run_time });
	} catch (err) {
		self.postMessage({ type: 'error', error: err?.message || String(err) });
	}
};
