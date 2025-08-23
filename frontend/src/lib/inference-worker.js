// src/lib/inference-worker.js
import { RunBulkPipeline } from '$lib/utils/inferencePipeline.js';

let pipeline = new RunBulkPipeline();
let isRunning = false;


// Helper function to reconstruct File-like objects for dlonwebjs
function reconstructFileObjects(files) {
  return files.map(file => {
    if (file.isFileObject) {
      if (file.arrayBuffer) {
        // Reconstruct File-like object from ArrayBuffer
        const blob = new Blob([file.arrayBuffer], { type: file.type });
        
        // Create a File-like object that mimics the original File API
        const reconstructedFile = new File([blob], file.name, {
          type: file.type,
          lastModified: file.lastModified
        });
        
        return reconstructedFile;
        
      } else if (file.blobUrl) {
        // If using blob URLs, we need to fetch the data
        // Note: This approach requires async handling
        return fetch(file.blobUrl)
          .then(response => response.blob())
          .then(blob => new File([blob], file.name, {
            type: file.type,
            lastModified: file.lastModified
          }));
          
      } else if (file.file) {
        // If the original File object was preserved
        return file.file;
      }
    }
    
    return file; // Return as-is if not a File object
  });
}


self.onmessage = async (event) => {
	const { type, payload } = event.data;

	switch (type) {
		case 'INIT': {
			try {
				await pipeline.initialize({ settings: payload?.settings });
				postMessage({ type: 'READY', data: {message:"Initialized successfully"} });
			} catch (err) {
				postMessage({ type: 'ERROR', data: { error: err.message } });
			}
			break;
		}

		case 'LOAD_DATA': {
			try {
				const { raw_files, model, options, location } = payload;
				
				// Reconstruct File objects
				let reconstructedFiles = reconstructFileObjects(raw_files);
				
				// Handle async file reconstruction for blob URLs
				if (reconstructedFiles.some(f => f instanceof Promise)) {
					reconstructedFiles = await Promise.all(reconstructedFiles);
				}
				
				// Now load the data using the original pipeline method
				await pipeline.loadData(reconstructedFiles, options);
				
				self.postMessage({ type: 'DATA_LOADED' });
				
			} catch (error) {
				console.error('Data loading failed:', error);
				self.postMessage({ 
					type: 'ERROR', 
					data: { error: `Data loading failed: ${error.message}` }
				});
			}
			break;
		}

		case 'LOAD_MODEL': {
			try {
				await pipeline.loadModel(payload.mode, payload.modelName);
				postMessage({
					type: 'MODEL_READY',
					data: { model: payload.modelName, mode: payload.mode }
				});
			} catch (err) {
				postMessage({ type: 'ERROR', data: { error: err.message } });
			}
			break;
		}

		case 'PROCESS_BATCH': {
			if (isRunning) {
				postMessage({
					type: 'ERROR',
					data: { error: 'Pipeline is already running' }
				});
				return;
			}
			try {
				isRunning = true;

				const total = pipeline.data?.length || 0;
				let current = 0;
				const results = [];

				// Run inference sequentially so we can emit progress
				for (const d of pipeline.data) {
					const output = await pipeline.batch_task.task.runInference(d, payload.options || {});
					results.push(output);
					current++;

					postMessage({
						type: 'PROGRESS',
						data: {
							current,
							total,
							percentage: total > 0 ? (current / total) * 100 : 0
						}
					});
				}

				isRunning = false;
				postMessage({ type: 'COMPLETE', data: results });
			} catch (err) {
				isRunning = false;
				postMessage({ type: 'ERROR', data: { error: err.message } });
			}
			break;
		}

		case 'STATUS': {
			postMessage({
				type: 'STATUS_RESULT',
				data: {
					isRunning,
					model: pipeline.modelName,
					count: pipeline.data?.length || 0
				}
			});
			break;
		}

		case 'CANCEL': {
			// No real cancel support in tfjs yet, just flag
			isRunning = false;
			postMessage({ type: 'CANCELLED' });
			break;
		}

		default:
			postMessage({
				type: 'ERROR',
				data: { error: `Unknown message type: ${type}` }
			});
	}
};
