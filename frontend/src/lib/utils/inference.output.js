/**
 * InferenceOutput Class
 * Wrapper for inference output data with helper methods for easy access
 */
export class InferenceOutput {
  constructor(data) {
    Object.assign(this, data);
  }

  /**
   * Get simplified file list for sidebar
   * @returns {Array<{key: string, type: string}>}
   */
  get fileList() {
    return this.files.map(f => ({ key: f.key, type: f.type }));
  }

  /**
   * Get file entry by key
   * @param {string} key - File key
   * @returns {Object|null}
   */
  getFile(key) {
    return this.files.find(f => f.key === key) || null;
  }

  /**
   * Get single output by type
   * @param {string} key - File key
   * @param {string} type - Output type (e.g., 'bbox_image', 'mask', 'overlay')
   * @returns {Object|null}
   */
  getOutput(key, type) {
    const file = this.getFile(key);
    return file?.outputs.find(o => o.type === type) || null;
  }

  /**
   * Get multiple outputs by type
   * @param {string} key - File key
   * @param {string} type - Output type (e.g., 'crop')
   * @returns {Array<Object>}
   */
  getOutputs(key, type) {
    const file = this.getFile(key);
    return file?.outputs.filter(o => o.type === type) || [];
  }

  /**
   * Get all files of a specific type across all inputs
   * @param {string} type - Output type
   * @returns {Array<File>}
   */
  getAllOfType(type) {
    return this.files.flatMap(f => 
      f.outputs.filter(o => o.type === type).map(o => o.file)
    );
  }

  /**
   * Get all files by category
   * @param {string} category - Category ('visualization', 'derivative', 'analysis')
   * @returns {Array<File>}
   */
  getAllByCategory(category) {
    return this.files.flatMap(f => 
      f.outputs.filter(o => o.category === category).map(o => o.file)
    );
  }

  /**
   * Get all input files
   * @returns {Array<File>}
   */
  getAllInputs() {
    return this.files.map(f => f.input);
  }

  // Object Detection helpers
  getBboxImage(key) {
    return this.getOutput(key, 'bbox_image')?.file || null;
  }

  getCrops(key) {
    return this.getOutputs(key, 'crop').map(o => o.file);
  }

  getDetections(key) {
    return this.getFile(key)?.metadata?.detections || [];
  }

  // Segmentation helpers
  getMask(key) {
    return this.getOutput(key, 'mask')?.file || null;
  }

  getOverlay(key) {
    return this.getOutput(key, 'overlay')?.file || null;
  }

  /**
   * Export as JSON report (excludes file objects)
   */
  toJSON() {
    const { files, ...rest } = this;
    return {
      ...rest,
      files: files.map(f => ({
        key: f.key,
        type: f.type,
        index: f.index,
        timings: f.timings,
        metadata: f.metadata,
        outputs: f.outputs.map(o => ({
          type: o.type,
          name: o.name,
          category: o.category,
          metadata: o.metadata,
          size: o.file.size || o.file.buffer?.length || 0
        }))
      }))
    };
  }

  /**
   * Download timing report as JSON
   */
  downloadReport() {
    const report = this.toJSON();
    const blob = new Blob([JSON.stringify(report, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inference_report_${this.task.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  /**
 * Export complete report with all outputs serialized (excludes input files)
 */
/**
 * Export complete report with output metadata (excludes file data)
 */
toReportWithOutputs() {
  const report = {
    ...this.toJSON(), // Base report structure
    files: []
  };

  for (const file of this.files) {
    const fileReport = {
      key: file.key,
      type: file.type,
      index: file.index,
      timings: file.timings,
      metadata: file.metadata,
      outputs: file.outputs.map(output => ({
        type: output.type,
        name: output.name,
        category: output.category,
        metadata: output.metadata,
        size: output.file.size
      }))
    };

    report.files.push(fileReport);
  }

  return report;
}

}
