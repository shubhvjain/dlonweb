const {pathToFileURL} = require('url')
const tf = require("@tensorflow/tfjs-node");
// const { Buffer } = require("buffer");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");
module.exports = {
  environment: "node",
  env: {
    tf,
    getInputType: (input) => {
      if (!input || !input.buffer) return null;
    
      // Normalize metadata keys
      const name = input.originalname || input.name || "";
      const type = input.mimetype || input.type || "";
    
      if (!type || !name) {
        throw new Error("getInputType: Input must have a name and type/mimetype");
      }
    
      const ext = path.extname(name).slice(1).toLowerCase();
    
      if (type.startsWith("image/")) {
        return ["tif", "tiff"].includes(ext)
          ? { kind: "tiff", structure: "complex" }
          : { kind: "image", structure: "simple" };
      }
    
      if (type.startsWith("video/")) {
        return { kind: "video", structure: "complex" };
      }
    
      if (type.startsWith("text/") || ext === "txt") {
        return { kind: "text", structure: "simple" };
      }
    
      return null;
    },

    decodeImageToTensor: decodeImageToTensorNode,

    decodeVideoToTensors: async (buffer) => {
      throw new Error("decodeVideoToTensors not implemented in Node yet");
    },

    decodeTiffToTensors: async (buffer) => {
      throw new Error("decodeTiffToTensors not implemented in Node yet");
    },

    decodeTextToTensor: async (buffer) => {
      const text = buffer.toString("utf-8");
      const chars = Array.from(text).map((c) => c.charCodeAt(0));
      return tf.tensor(chars, [1, chars.length]); // [batch, length]
    },

    // Convert tensor to PNG Buffer
    tensorToBlob: async (tensor, data) => {
      const imageTensor = tensor.squeeze(); // remove batch dim
      return await tf.node.encodePng(imageTensor);
    },

    // Use original Buffer directly
    fileLikeToBlob: async (input, data) => {
      return input.buffer;
      //throw new Error("Unsupported file-like input in Node");
    },

    // Future: video/image stacks
    complexToBlob: async (tensor, data) => {
      throw new Error("Complex toBlob() not implemented in Node");
    },

    /**
     * @param {Object} file - Multer file object with .buffer
     * @param {string} type - Transform type
     * @param {Object} options - Transform-specific options
     * @returns {Promise<{buffer: Buffer, mimetype: string, originalname: string}>}
     */
    imageTransform: async (file, type, options = {}) => {
      if (!file || !file.buffer) {
        throw new Error(
          "Input must be a Multer-style file object with a buffer"
        );
      }

      switch (type) {
        case "add_bounding_boxes": {
          const img = await loadImage(file.buffer);

          const canvas = createCanvas(img.width, img.height);
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);

          if (!options.boxes || !Array.isArray(options.boxes)) {
            // No boxes? Return original.
            return {
              buffer: file.buffer,
              mimetype: file.mimetype,
              originalname: file.originalname,
            };
          }

          ctx.strokeStyle = "red";
          ctx.fillStyle = "red";
          ctx.lineWidth = 2;
          ctx.font = "16px Arial";

          options.boxes.forEach(({ bbox, class: label, score }) => {
            if (!bbox) return;
            const [x, y, w, h] = bbox;
            ctx.strokeRect(x, y, w, h);
            ctx.fillText(
              `${label} (${(score * 100).toFixed(1)}%)`,
              x,
              y > 10 ? y - 5 : y + 15
            );
          });

          // Get the transformed image as buffer
          const outputBuffer = canvas.toBuffer("image/png");

          return {
            file: {
              buffer: outputBuffer,
              name: file.originalname || "image.png",
              type: "image/png"
            }
          };
        }
        
        case "add_segmentation_mask": {
          const img = await loadImage(file.buffer);
          const canvas = createCanvas(img.width, img.height);
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
    
          const mask = options.mask; // Expect a tf.Tensor mask
          if (!mask || typeof mask.data !== 'function') {
            throw new Error('Segmentation mask must be a valid tensor');
          }
    
          // Prepare mask tensor:
          let tensor = mask;
    
          // Squeeze batch or channel dims if singleton
          const shape = tensor.shape;
          if (shape.length > 4) {
            tensor = tensor.squeeze([0, 1, 4]); // remove extra dims if 1
          } else if (shape.length === 4 && shape[0] === 1) {
            tensor = tensor.squeeze([0]);
          } else if (shape.length === 3 && shape[0] === 1) {
            tensor = tensor.squeeze([0]);
          }
    
          // Make sure tensor shape is [H, W] or [H, W, 1]
          if (tensor.shape.length === 2) {
            tensor = tensor.expandDims(-1);
          }
    
          // Resize mask to canvas size using nearest neighbor
          const resized = tf.image.resizeNearestNeighbor(tensor, [canvas.height, canvas.width]);
          const maskData = await resized.data();
    
          // Get image pixel data
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
          // Overlay semi-transparent red where mask value > 0.5
          for (let i = 0; i < maskData.length; i++) {
            if (maskData[i] > 0.5) {
              imgData.data[i * 4 + 0] = 255; // R
              imgData.data[i * 4 + 1] = 0;   // G
              imgData.data[i * 4 + 2] = 0;   // B
              imgData.data[i * 4 + 3] = 128; // A (semi-transparent)
            }
          }
    
          ctx.putImageData(imgData, 0, 0);
    
          tf.dispose([resized, tensor]);
    
          const outputBuffer = canvas.toBuffer("image/png");
    
          return {
            file: {
              buffer: outputBuffer,
              name: file.originalname || "image.png",
              type: "image/png"
            }
          };
        }

        default:
          throw new Error(`Unknown transform type: ${type}`);
      }
    },
    resolveModelLibraryPath(){
      const modelPath = path.resolve(
        'node_modules',
        'dlonwebjs',
        'dist'
      );
      return pathToFileURL(modelPath).href+"/";
    }
  },
};



async function decodeImageToTensorNode(imageBuffer, options) {
  let imgTensor = tf.node.decodeImage(imageBuffer.buffer, 3);

  const [, height, width] = options.inputShape;

  // Resize only if both height and width are explicitly defined (> 0)
  if (height > 0 && width > 0 &&
      (imgTensor.shape[0] !== height || imgTensor.shape[1] !== width)) {
    imgTensor = tf.image.resizeBilinear(imgTensor, [height, width]);
  }

  // Convert to correct dtype
  if (options.dtype === 'float32') {
    imgTensor = imgTensor.toFloat();
    if (options.normalize) {
      imgTensor = imgTensor.div(255);
    }
  } else if (options.dtype === 'int32') {
    imgTensor = imgTensor.toInt();
  }

  // Add batch dimension only if required
  if (options.addBatchDim && imgTensor.shape.length === 3) {
    imgTensor = imgTensor.expandDims(0);
  }

  return imgTensor;
}



// async function decodeImageToTensorNode(fileBuffer, options = {}) {
//   const {
//     targetHeight,
//     targetWidth,
//     targetChannels,
//     normalize,
//     addBatchDim = false,
//     dtype = null,
//   } = options;

//   let tensor = tf.node.decodeImage(fileBuffer.buffer, targetChannels);

//   // Only resize if target size is explicitly set
//   if (targetHeight && targetWidth) {
//     tensor = tf.image.resizeBilinear(tensor, [targetHeight, targetWidth]);
//   }

//   // Normalize pixel values
//   if (normalize === '0-1') {
//     tensor = tensor.toFloat().div(255);
//   } else if (normalize === '-1-1') {
//     tensor = tensor.toFloat().div(127.5).sub(1);
//   } else if (dtype === 'float32') {
//     tensor = tensor.toFloat();
//   } else if (dtype === 'int32') {
//     tensor = tensor.toInt();
//   }

//   // Convert channels if necessary
//   if (tensor.shape[2] !== targetChannels) {
//     if (tensor.shape[2] === 3 && targetChannels === 1) {
//       tensor = tf.image.rgbToGrayscale(tensor);
//     } else {
//       throw new Error(`Expected ${targetChannels} channels but got ${tensor.shape[2]}`);
//     }
//   }

//   // Add batch dimension only if needed and input is 3D
//   if (addBatchDim && tensor.shape.length === 3) {
//     tensor = tensor.expandDims(0);
//   }

//   return tensor;
// }

