const tf = require("@tensorflow/tfjs-node");
// const { Buffer } = require("buffer");
const path = require("path");

module.exports = {
  environment: "node",
  env: {
    tf,
    getInputType: (input) => {
      if (Buffer.isBuffer(input)) {
        // You must supply the type info externally or infer from magic bytes (out of scope)
        throw new Error(
          "env.getInputType needs mimetype/originalname for Buffer"
        );
      }

      if (input && input.buffer && input.mimetype && input.originalname) {
        const ext = path.extname(input.originalname).slice(1).toLowerCase();
        const mimetype = input.mimetype;

        if (mimetype.startsWith("image/") && !["tiff", "tif"].includes(ext)) {
          return { kind: "image", structure: "simple" };
        } else if (mimetype.startsWith("video/")) {
          return { kind: "video", structure: "complex" };
        } else if (["tiff", "tif"].includes(ext)) {
          return { kind: "tiff", structure: "complex" };
        } else if (mimetype.startsWith("text/") || ext === "txt") {
          return { kind: "text", structure: "simple" };
        }
      }

      return null;
    },

    decodeImageToTensor: async (file) => {
      //const tensor = tf.node.decodeImage(buffer, 3); // RGB
      //return tensor.expandDims(0); // Add batch dimension

      const fb = await file.buffer;
      return tf.node.decodeImage(fb, 3).expandDims(0); 
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
  },
};
