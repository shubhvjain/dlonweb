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

    decodeImageToTensor: async (file, options) => {
      const {
        resize = null,
        normalize = false,
        addBatchDim = false,
        dtype = null,
      } = options;

      if (!file || !file.buffer) {
        throw new Error("Expected Multer file with .buffer");
      }

      // Decode to Tensor3D [h, w, 3]
      let tensor = tf.node.decodeImage(file.buffer, 3);

      if (resize) {
        tensor = tf.image.resizeBilinear(tensor, resize);
      }

      if (normalize) {
        tensor = tensor.toFloat().div(255.0);
      } else if (dtype === "float32") {
        tensor = tensor.toFloat();
      } else if (dtype === "int32") {
        tensor = tensor.toInt();
      }

      if (addBatchDim) {
        tensor = tensor.expandDims(0); // shape: [1, h, w, 3]
      }

      return tensor;
    },

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

        default:
          throw new Error(`Unknown transform type: ${type}`);
      }
    },
  },
};
