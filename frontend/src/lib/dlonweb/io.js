// handling inputs of various types

/***
 Read the input file and generate input for inference/training 
 
 type 1 : tiff files 

 

  
 */

export const input_types = {
	tiff: 'Image stack (.tiff/.tif)',
	image: 'Image (.png)',
	video: 'Video'
};

export const get_input_types = () => {
	let list = [];
	Object.keys(input_types).map((itm) => {
		list.push({ name: input_types[itm], value: itm });
	});
	return list;
};
