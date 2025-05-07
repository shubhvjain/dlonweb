import axios from "axios";

export const get_model_data = async ()=>{
	let file_data = await axios.get("models/models.json")
	let custom_models = file_data.data["projects"]
	return custom_models
}

export const get_models_list = async () => {
	let file_data = await axios.get("models/models.json")
	let custom_models = file_data.data["projects"]
	//console.log(custom_models)
	let list = [];
	let details = {};
	Object.keys(custom_models).map((projs) => {
		//console.log(projs);
		Object.keys(custom_models[projs].models).map((model) => {
			//console.log(model);
			let model_name = `${projs}-${model}`;
			let m_data = custom_models[projs]['models'][model];
			//console.log(m_data);
			let mode_value = `${custom_models[projs]['title_short']} - ${m_data.title}`;
			list.push({ name: mode_value, value: model_name });
			details[model_name] = m_data;
		});
	});
	//console.log(list);
	//console.log(details);
	return { list, details };
};
