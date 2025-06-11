
export class Library {
  static data = {
    "projects":{
      "tf":{
        "list":false,
        "title_short":"Tensorflow",
        "website":"https://cocodataset.org",
        "models":{
          "coco-ssd":{
            "type":"classify_image",
            "title":"Object Detection (coco-ssd)",
            "path":""
          } 
        }
      },
      // "deepd3": {
      //   "list":true,
      //   "title_short": "DeepD3 ",
      //   "title": "DeepD3 (A Deep Learning Framework for Detection of Dendritic Spines and Dendrites)",
      //   "source":"Fernholz, M. H. P., Guggiana Nilo, D. A., Bonhoeffer, T., & Kist, A. M. (2024). DeepD3, an open framework for automated quantification of dendritic spines. In M. H. Hennig (Ed.), PLOS Computational Biology (Vol. 20, Issue 2, p. e1011774). Public Library of Science (PLoS). https://doi.org/10.1371/journal.pcbi.1011774",
      //   "description":"Pre trained models to perform semantic segmentation of dendrites and dendrite spines in microscopy data",
      //   "website": "https://deepd3.forschung.fau.de/",
      //   "model_input": "Microscopy image stack in TIF/TIFF format",
      //   "model_output":"Segmented stack with dendrites and dendritic spines",
      //   "models": {
      //     "8f": {
      //       "title": "Dendritic spine image segmentation for 8 base filters",
      //       "type":"segment_image",
      //       "input_type": "tiff",
      //       "input_help":"",
      //       "output_type": "tiff",
      //       "path": "library/DeepD3_8F"
      //     },
      //     "16f": {
      //       "title": "Dendritic spine image segmentation for 16 base filters",
      //       "input_type": "tiff",
      //       "type":"segment_image",
      //       "path": "library/DeepD3_8F"
      //     },
      //       "32f": {
      //       "title": "Dendritic spine image segmentation for 32 base filters",
      //       "input_type": "tiff",
      //       "type":"segment_image",
      //       "path": "library/DeepD3_8F"
      //     }
      //   }
      // },
      "bagls":{
        "list":true,
        "title_short":"BAGLS",
        "title":"Benchmark for Automatic Glottis Segmentation (BAGLS)",
        "source":"Gómez, P., Kist, A.M., Schlegel, P. et al. BAGLS, a multihospital Benchmark for Automatic Glottis Segmentation. Sci Data 7, 186 (2020). https://doi.org/10.1038/s41597-020-0526-3",
        "description":" ",
        "website":"https://www.bagls.org/",
        "models":{
          "segment":{
            "title":"Segment Endoscopic Image using BAGLS",
            "path":"library/bagls_rgb",
            "type":"segment_image",
          }
        }
      }
    }
  }

  static async loadData() {
    // if (!this.data) {
    //   const response = await fetch('models.json');
    //   if (!response.ok) throw new Error('Failed to load model.json');
    //   this.data = await response.json();
    // }
    return this.data;
  }

  static async get_model_list() {
    const data = await this.loadData();
    const result = [];
    for (const [projectKey, project] of Object.entries(data.projects)) {
      if (!project.models) continue;
      for (const [modelKey,model] of Object.entries(project.models)) {
        const label = `${project.title_short} (${modelKey})`;
        const value = `${projectKey}.${modelKey}`;
        result.push({ label, value, type : model.type });
      }
    }
    return result;
  }

  static async get_model(...args) {
    const data = await this.loadData();
    let projectKey, modelKey;

    if (args.length === 1) {
      [projectKey, modelKey] = args[0].split('.');
    } else if (args.length === 2) {
      [projectKey, modelKey] = args;
    } else {
      throw new Error('Invalid arguments');
    }

    const project = data.projects[projectKey];
    if (!project || !project.models || !project.models[modelKey]) return null;

    return project.models[modelKey] || null;
  }
}