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
    async decodeImageToTensor(file, options = {}) {
      const {
        resize = null,
        normalize = false,
        addBatchDim = false,
        dtype = null,
      } = options;
    
      const img = await loadImageElementFromFile(file);
      let tensor = tf.browser.fromPixels(img); // shape: [h, w, 3]
    
      if (resize) {
        tensor = tf.image.resizeBilinear(tensor, resize);
      }
    
      if (normalize) {
        tensor = tensor.toFloat().div(255.0); // normalize to [0, 1]
      } else if (dtype === 'float32') {
        tensor = tensor.toFloat();
      } else if (dtype === 'int32') {
        tensor = tensor.toInt();
      }
    
      if (addBatchDim) {
        tensor = tensor.expandDims(0); // shape: [1, h, w, 3]
      }
    
      return tensor;
    },

    // /**
    //  * @param {File} file
    //  * @param {Object} options
    //  * @returns {Promise<tf.Tensor[]>}
    //  */
    // async decodeVideoToTensors(file, options = {}) {
    //   // Not implemented yet
    //   throw new Error("decodeVideoToTensors not implemented in browser env");
    // },

    async decodeVideoToImages (file, options = { fps: 10 }) {
      return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        video.src = URL.createObjectURL(file);
        video.crossOrigin = "anonymous";
        video.preload = "auto";
        video.muted = true;
    
        video.onloadedmetadata = async () => {
          const duration = video.duration;
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
    
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
    
          const results = [];
    
          const totalFrames = Math.floor(duration * options.fps);
          for (let i = 0; i < totalFrames; i++) {
            const time = i / options.fps;
            video.currentTime = time;
    
            await new Promise(res => video.onseeked = res);
            ctx.drawImage(video, 0, 0);
    
            const blob = await new Promise(r => canvas.toBlob(r, "image/png"));
            const arrayBuffer = await blob.arrayBuffer();
            const tensor = tf.browser.fromPixels(canvas);
    
            results.push({
              tensor,
              timestamp: time * 1000,
              raw: new Blob([arrayBuffer], { type: "image/png" }),
            });
          }
    
          resolve(results);
        };
    
        video.onerror = () => reject(new Error("Failed to load video"));
      });
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

    complexToBlob: async (input, data) => {
      if (!(input instanceof Blob)) {
        throw new Error("Expected input to be a Blob or File (video)");
      }
    
      // Optionally you can validate mime type
      if (!input.type.startsWith("video/")) {
        throw new Error("Invalid input type for video blob");
      }
    
      // Return as-is or clone if needed
      return new Blob([input], { type: input.type });
    },


    imageTransform :  async(input, type, options)=> {
      if (!(input instanceof File)) {
        throw new Error("Input must be a File object");
      }
      switch (type) {
        case "add_bounding_boxes":
          // Convert input (File/Blob) to HTMLImageElement, then draw on canvas, etc.
          const img = await loadImageElementFromFile(input);
    
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
    
          if (!options.boxes || !Array.isArray(options.boxes)) {
            //throw new Error("No bounding boxes provided");
            return {file:input}
          }
    
          ctx.strokeStyle = "red";
          ctx.fillStyle = "red";
          ctx.lineWidth = 2;
          ctx.font = "16px Arial";
    
          options.boxes.forEach(({ bbox, class: label, score }) => {
            if (!bbox) return;
            const [x, y, w, h] = bbox;
            ctx.strokeRect(x, y, w, h);
            ctx.fillText(`${label} (${(score * 100).toFixed(1)}%)`, x, y > 10 ? y - 5 : y + 15);
          });
          
    
          const blob = await new Promise((res) => canvas.toBlob(res, input.type || "image/png"));
    
          return {
            file: new File([blob], input.name || "image.png", { type: input.type || "image/png" }),
          };
    
        // other transforms...
    
        default:
          throw new Error(`Unknown transform type: ${type}`);
      }
    }


  }
};


function loadImageElementFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = () => {
      img.src = reader.result;
    };

    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);

    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

function fileToImageElement(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = () => {
      img.src = reader.result;
    };

    img.onload = () => resolve(img);
    img.onerror = reject;
    reader.onerror = reject;

    reader.readAsDataURL(file);
  });
}