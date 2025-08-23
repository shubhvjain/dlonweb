// InferencePipeline.js - Core pipeline class for the browser
import { Library, InferenceTask, Data } from 'dlonwebjs';
import { browserOptions } from '$lib/utils/data.browser';
import axios from 'axios';

export class InferencePipeline {
	constructor() {
		// mode = 'browser',run_mode="web_worker",worker
		this.workerReady = false;
		this.taskRunning = false;
		this.currentTask = null;
	}

	async initWorker() {
		if (this.workerReady) return Promise.resolve();

		if (!this.worker) throw new Error('Worker not initialized');

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.worker.removeEventListener('message', handler);
				reject(new Error('Worker initialization timeout'));
			}, 10000);

			const handler = (event) => {
				const { type, data } = event.data;
				if (type === 'READY') {
					this.workerReady = true;
					clearTimeout(timeout);
					this.worker.removeEventListener('message', handler);
					resolve();
				} else if (type === 'ERROR') {
					clearTimeout(timeout);
					this.worker.removeEventListener('message', handler);
					reject(new Error(data?.error || 'Worker initialization failed'));
				}
			};

			this.worker.addEventListener('message', handler);
			this.worker.postMessage({ type: 'INIT' });
		});
	}

	async run(
		inputFiles = [],
		modelDetails = { name: '', model: null },
		runOptions = { location: 'browser', mode: 'web_worker', worker: null },
		onProgress = () => {}
	) {
		if (inputFiles.length == 0) {
			throw new Error('No input provided');
		}

		if (modelDetails.name == '' && model == null) {
			throw new Error('No model name or model provided');
		}

		// Initialize worker if needed and using worker mode
		const useWorker = runOptions.location === 'browser' && runOptions.mode == 'web_worker';

		if (useWorker && !this.workerReady) {
			if (!runOptions.worker) {
				throw new Error('No worker provided to run inference on a web worker');
			}
			this.worker = runOptions.worker;
			await this.initWorker();
		}

		// Cancel any existing task
		if (this.taskRunning) {
			this.cancel();
		}

		this.taskRunning = true;

		// now running the inferenceTask

		try {
			// Create InferenceTask with appropriate mode
			const runMode = runOptions.mode;

			const task = new InferenceTask({
				...browserOptions,

				modelName: modelDetails.name,
				modelFiles: modelDetails.name === 'custom' ? modelDetails.model : null,
				webRunner: useWorker ? this._createWebRunner(onProgress) : null,
				run_mode: runMode
			});

      if (runMode === 'main_thread') {

        //console.log(runMode)
				await task.loadModel();
				onProgress({ current: 2, total: 4, stage: 'Model loaded' });
			}

			// Convert inputFiles to Data objects
			const dataArray = await this._prepareDataArray(inputFiles);
			console.log(dataArray);
			// Load data into task

			let model_options = await Library.getModelOptions(modelDetails.name)
      console.log(model_options)
			await task.loadData(dataArray,model_options);
			// console.log(task.input_data_map)

			onProgress({ current: 1, total: 4, stage: 'Data loaded' });

			// Load model (only for main thread mode)
			

			// Run inference
			await task.runModel();
			onProgress({ current: 3, total: 4, stage: 'Inference complete' });


      console.log(task.output_data_map)

			// Generate output
			const results = await task.generateOutput();
			onProgress({ current: 4, total: 4, stage: 'Output generated' });

			console.log(results);

			return this._formatResults(results, task.output_data_map);
		} catch (error) {
			throw new Error(`Pipeline failed: ${error.message}`);
		} finally {
			this.taskRunning = false;
			this.currentTask = null;
		}
	}

	_createWebRunner(onProgress) {
		return {
			run: async (payload) => {
				return new Promise((resolve, reject) => {
					const taskId = Date.now().toString();
					this.currentTask = taskId;

					const handler = (event) => {
						const { type, data, id } = event.data;

						if (id && id !== taskId) return;

						switch (type) {
							case 'PROGRESS':
								onProgress(data);
								break;

							case 'INFERENCE_COMPLETE':
								this.worker.removeEventListener('message', handler);
								resolve(data.result);
								break;

							case 'ERROR':
								this.worker.removeEventListener('message', handler);
								reject(new Error(data?.error || 'Worker inference failed'));
								break;
						}
					};

					this.worker.addEventListener('message', handler);
					this.worker.postMessage({
						type: 'RUN_INFERENCE',
						payload,
						id: taskId
					});
				});
			}
		};
	}

	async _prepareDataArray(inputFiles) {
		const dataArray = [];

		console.log(inputFiles);
		for (let index = 0; index < inputFiles.length; index++) {
			const element = inputFiles[index];
			console.log(element);
			const data = new Data(element, { ...browserOptions });
			await data.load();
			dataArray.push(data);
		}

		// for (let f in inputFiles) {
		//   console.log(f)
		//   if (name === 'modelPath' || !fileData) continue;

		//   const data = new Data(name, { ...browserOptions});
		//   await data.load()

		//   // Set the file data (assuming it's already processed)
		//   if (fileData.file) {
		//     data.file = fileData.file;
		//   }
		//   if (fileData.input_tensor) {
		//     data._tensor = fileData.input_tensor;
		//   }

		//   dataArray.push(data);
		// }

		return dataArray;
	}

	_formatResults(results, outputDataMap) {
		// Convert results back to the expected format
		const formattedResults = {};

		Object.keys(outputDataMap).forEach((name, index) => {
			formattedResults[name] = {
				output_tensor: results[index],
				processed: true
			};
		});

		return formattedResults;
	}

	cancel() {
		if (this.worker && this.taskRunning && this.currentTask) {
			this.worker.postMessage({
				type: 'CANCEL',
				id: this.currentTask
			});
		}
		this.taskRunning = false;
		this.currentTask = null;
	}

	terminate() {
		this.cancel();
		if (this.worker) {
			this.worker.terminate();
			this.worker = null;
			this.workerReady = false;
		}
	}
}
