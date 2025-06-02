// import * as tf from '@tensorflow/tfjs';
import { BaseImage } from './data';

export class ImageSegmentation {
  /**
   * Run the segmentation pipeline on a BaseImage
   * @param {tf.GraphModel | tf.LayersModel} model 
   * @param {BaseImage} baseImage 
   * @returns {Promise<{ segmented: BaseImage, pixelCount: number }>}
   */
  static async run(model, baseImage) {
    tf.engine().startScope();
    const inputTensor = await this.processInput(model, baseImage);
    const prediction = await this.predictOutput(model, inputTensor);
    const outputBaseImage = await this.applySegmentationToImage(baseImage, prediction);
    //const pixelCount = await this.countWhitePixels(prediction);
    tf.engine().endScope();
    return { segmented: outputBaseImage };

  }

  /**
   * Preprocess BaseImage for model input
   * @param {tf.GraphModel | tf.LayersModel} model 
   * @param {BaseImage} baseImage 
   * @returns {tf.Tensor4D}
   */
  static async processInput(model, baseImage) {
    const [_, targetHeight, targetWidth, targetChannels] = model.inputs[0].shape;
    const tensor = await baseImage.toTensor({
      targetHeight,
      targetWidth,
      normalize: true,
    });

    if (tensor.shape[3] !== targetChannels) {
      throw new Error(`Model expects ${targetChannels} channels, but got ${tensor.shape[3]}`);
    }

    return tensor;
  }

  /**
   * Run model prediction
   * @param {tf.GraphModel | tf.LayersModel} model 
   * @param {tf.Tensor4D} inputTensor 
   * @returns {tf.Tensor3D} prediction mask
   */
  static async predictOutput(model, inputTensor) {
    const prediction = model.predict(inputTensor);
    return prediction.squeeze(); // shape: [H, W] or [H, W, C]
  }

  /**
   * Overlay segmentation mask on original image and return new BaseImage
   * @param {BaseImage} baseImage 
   * @param {tf.Tensor} prediction 
   * @returns {Promise<BaseImage>}
   */
  static async applySegmentationToImage(baseImage, prediction) {
    const width = baseImage.image_width;
    const height = baseImage.image_height;

    const mask = tf.image.resizeNearestNeighbor(prediction.expandDims(-1), [height, width]);
    const maskData = await mask.data();

    const img = await baseImage._loadHTMLImage();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    const imgData = ctx.getImageData(0, 0, width, height);
    for (let i = 0; i < maskData.length; i++) {
      if (maskData[i] > 0.5) {
        imgData.data[i * 4 + 0] = 255; // R
        imgData.data[i * 4 + 1] = 0;   // G
        imgData.data[i * 4 + 2] = 0;   // B
        imgData.data[i * 4 + 3] = 127; // A
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, baseImage.file_type));
    return await BaseImage.fromBlob(blob, baseImage.file_name);
  }

  /**
   * Render a tensor to a canvas
   * @param {tf.Tensor3D} segmentedResult 
   * @returns {Promise<HTMLCanvasElement>}
   */
  static async renderWithToPixels(segmentedResult) {
    const [height, width] = segmentedResult.shape;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    await tf.browser.toPixels(segmentedResult, canvas);
    return canvas;
  }

  /**
   * Count number of positive pixels in the binary prediction mask
   * @param {tf.Tensor} prediction 
   * @returns {Promise<number>}
   */
  static async countWhitePixels(prediction) {
    const binaryMask = prediction.greater(tf.scalar(0.5));
    const count = await binaryMask.sum().data();
    tf.dispose(binaryMask);
    return count[0];
  }
}