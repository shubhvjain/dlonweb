// server.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Data, InferenceTask, Library } = require('dlonwebjs');
const { adaptor } = require('./nodejs.adapter');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Multer configuration for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// ==================== ROUTES ====================

// Health check
app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'dlonwebjs inference server'
  });
});


// Run inference
app.post('/inference', upload.array('files'), async (req, res) => {
  try {
    // DEBUG: Log file information
    // console.log('[DEBUG] Received files:');
    // req.files.forEach((file, idx) => {
    //   console.log(`  File ${idx}:`, {
    //     name: file.originalname,
    //     type: file.mimetype,
    //     size: file.size,
    //     bufferLength: file.buffer ? file.buffer.length : 0,
    //     isBuffer: Buffer.isBuffer(file.buffer)
    //   });
    // });

    const { model_name, input_options } = req.body;
    
    if (!model_name) {
      return res.status(400).json({ 
        success: false, 
        error: 'model_name is required' 
      });
    }
    // Validate inputs
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No files uploaded' 
      });
    }
    // Parse input options
    const options = input_options ? JSON.parse(input_options) : {};
    
    console.log(`[Inference] Model: ${model_name}, Files: ${req.files.length}`);

    // Step 1: Load data
    const data = new Data(adaptor, req.files, options);
    await data.load();
    console.log('[Inference] Data loaded');

    // Step 2: Get model details and create tensors
    const modelDetails = await Library.get_model_options(model_name);
    await data.create_tensors(model_name, modelDetails);
    console.log('[Inference] Tensors created');

    // Step 3: Initialize inference task
    const task = new InferenceTask({
      env: adaptor,
      model_name: model_name,
      run_mode: 'main_thread'
    });

    // Step 4: Load data into task and run inference
    await task.load_data(data);
    console.log('[Inference] Model loaded');
    //console.log(task)
    await task.run_model();
    console.log('[Inference] Inference complete');

    //console.log(task.output_data_map)
    // Step 5: Generate outputs
    const outputs = await task.generate_outputs();
    console.log('[Inference] Outputs generated');

    // Step 6: Convert outputs to base64 for HTTP response
    const responseData = serializeForHTTP(outputs);

    res.json(responseData);

  } catch (error) {
    console.error('[Inference Error]', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Serialize output data for HTTP transmission (Node.js only)
 * Converts Buffer objects to base64 strings
 * 
 * @param {Object} outputData - Raw output data with Buffer objects
 * @returns {Object} Serialized data ready for res.json()
 */
const serializeForHTTP = (outputData) => {
  return {
    ...outputData,
    files: outputData.files.map(fileEntry => ({
      ...fileEntry,
      input: {
        name: fileEntry.input.name || fileEntry.input.originalname,
        type: fileEntry.input.type || fileEntry.input.mimetype,
        size: fileEntry.input.size,
        data: fileEntry.input.buffer.toString('base64')
      },
      outputs: fileEntry.outputs.map(output => ({
        type: output.type,
        name: output.name,
        category: output.category,
        metadata: output.metadata,
        file: {
          name: output.file.name,
          type: output.file.type,
          size: output.file.buffer.length,
          data: output.file.buffer.toString('base64')
        }
      }))
    }))
  };
}


// ==================== START SERVER ====================

app.listen(port, () => {
  console.log(`  dlonwebjs Inference Server`);
  console.log(`  Running at: http://localhost:${port}`);
});
