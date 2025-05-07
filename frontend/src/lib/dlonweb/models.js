export const custom_models = {
	deepd3: {
		title_short: 'DeepD3',
		title: 'DeepD3 (A Deep Learning Framework for Detection of Dendritic Spines and Dendrites)',
		source:
			'Fernholz, M. H. P., Guggiana Nilo, D. A., Bonhoeffer, T., & Kist, A. M. (2024). DeepD3, an open framework for automated quantification of dendritic spines. In M. H. Hennig (Ed.), PLOS Computational Biology (Vol. 20, Issue 2, p. e1011774). Public Library of Science (PLoS). https://doi.org/10.1371/journal.pcbi.1011774',
		description:
			'Pre trained models to perform semantic segmentation of dendrites and dendrite spines in microscopy data',
		website: 'https://deepd3.forschung.fau.de/',
		model_input: 'Microscopy image stack in TIF/TIFF format',
		model_output: 'Segmented stack with dendrites and dendritic spines',
		models: {
			'8f': {
				title: 'Dendritic spine image segmentation for 8 base filters',
				input_type: 'tiff',
				output_type: 'tiff',
				model_path: ''
			},
			'16f': {
				title: 'Dendritic spine image segmentation for 16 base filters'
			},
			'32f': {
				title: 'Dendritic spine image segmentation for 32 base filters'
			}
		}
	}
};

export const get_models_list = () => {
	let list = [];
	let details = {};
	Object.keys(custom_models).map((projs) => {
		console.log(projs);
		Object.keys(custom_models[projs].models).map((model) => {
			console.log(model);
			let model_name = `${projs}-${model}`;
			let m_data = custom_models[projs]['models'][model];
			console.log(m_data);
			let mode_value = `${custom_models[projs]['title_short']} - ${m_data.title}`;
			list.push({ name: mode_value, value: model_name });
			details[model_name] = m_data;
		});
	});
	console.log(list);
	console.log(details);
	return { list, details };
};
