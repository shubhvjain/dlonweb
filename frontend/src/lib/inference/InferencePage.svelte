<div class="p-2 p-md-4 mb-4 rounded border">
  <div class="col-lg-12 px-0">
    <h3 class="border-bottom">Inference</h3>

    <div class="pt-2 mt-2 mb-2 pb-2 d-flex justify-content-center">
      <div class="p-2">
        <h5>Model Selection</h5>
        <select class="form-select form-select-lg mt-2 mb-2" aria-label="Model type selection">
          <option selected>Select a model</option>
          <option value="1">Image Segmentation using U-net</option>
          <option value="2">Object Detection</option>
          <option value="3">Use Your Own Tensorflow Model</option>
        </select>
      </div>
    
      <div class="p-2">
        <h5>Input selection</h5>
        <select class="form-select form-select-lg mt-2 mb-2" aria-label="Input type selection ">
          <option selected>Select input type</option>
          <option value="0">Text</option>
          <option value="1">Image(s)</option>
          <option value="2">Video</option>
          <option value="3">Microscopy stack</option>
        </select>
      </div>
    
      <div class="p-2">
        <div class="p-2 m-1"></div>
        <button class="btn btn-lg btn-primary mt-2 mb-2">Run</button>
      </div>
    </div>
  </div>
</div>
