import * as tf from '@tensorflow/tfjs';

export const browserOptions = {
  environment: 'browser',

  env: {
		tf,

     getInputType(input){
      if (typeof tf !== "undefined" && input instanceof tf.Tensor) {
        return { kind: "tensor", structure: "simple" };
      }
    
      if (Array.isArray(input) && input[0] instanceof tf.Tensor) {
        return { kind: "tensor", structure: "complex" };
      }
    
      // File or Blob
      if (typeof File !== "undefined" && input instanceof File) {
        const ext = input.name.split(".").pop().toLowerCase();
        const type = input.type || "";
    
        if (type.startsWith("image/") && !["tiff", "tif"].includes(ext)) {
          return { kind: "image", structure: "simple" };
        } else if (type.startsWith("video/")) {
          return { kind: "video", structure: "complex" };
        } else if (["tiff", "tif"].includes(ext)) {
          return { kind: "tiff", structure: "complex" };
        } else if (type.startsWith("text/") || ext === "txt") {
          return { kind: "text", structure: "simple" };
        }
      }
    
      return null;
    },
    

    //// Human ====> Data
    /**
     * @param {File} file
     * @param {Object} options - { targetWidth, targetHeight, normalize }
     * @returns {Promise<tf.Tensor>}
     */
    async decodeImageToTensor(file, { targetWidth = 224, targetHeight = 224, normalize = true } = {}) {
      const url = URL.createObjectURL(file);
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = url;
      });

      return tf.tidy(() => {
        let tensor = tf.browser.fromPixels(img);
        tensor = tf.image.resizeBilinear(tensor, [targetHeight, targetWidth]);
        return normalize ? tensor.div(255).expandDims(0) : tensor.expandDims(0);
      });
    },

    /**
     * @param {File} file
     * @param {Object} options
     * @returns {Promise<tf.Tensor[]>}
     */
    async decodeVideoToTensors(file, options = {}) {
      // Not implemented yet
      throw new Error("decodeVideoToTensors not implemented in browser env");
    },

    /**
     * @param {File} file
     * @param {Object} options
     * @returns {Promise<tf.Tensor[]>}
     */
    async decodeTiffToTensors(file, options = {}) {
      // Not implemented yet
      throw new Error("decodeTiffToTensors not implemented in browser env");
    },

    /**
     * @param {File} file
     * @param {Object} options
     * @returns {Promise<tf.Tensor>}
     */
    async decodeTextToTensor(file, options = {}) {
      const text = await file.text();
      const chars = text.split('').map(char => char.charCodeAt(0));
      return tf.tensor(chars).expandDims(0);
    },

    // Data ===> Human 
    tensorToBlob: async (tensor, data) => {
      const imageTensor = tensor.squeeze(); // Remove batch dim
      const canvas = document.createElement("canvas");
      const [h, w, c] = imageTensor.shape;

      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      const imageData = new ImageData(new Uint8ClampedArray(await tf.browser.toPixels(imageTensor)), w, h);
      ctx.putImageData(imageData, 0, 0);

      return new Promise((resolve) =>
        canvas.toBlob((blob) => resolve(blob), "image/png")
      );
    },

    fileLikeToBlob: async (input, data) => {
      if (input instanceof Blob || input instanceof File) {
        return input;
      }
      throw new Error("Unsupported file-like input in browser");
    },

    complexToBlob: async (tensor, data) => {
      throw new Error("Complex toBlob() not implemented in browser");
    }
  }
};
