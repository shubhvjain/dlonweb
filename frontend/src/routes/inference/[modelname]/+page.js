import { error } from "@sveltejs/kit";


/** @type {import('./$types').PageLoad} */
export function load({ params }) {
  try {
    let modelName = params.modelname
    console.log("nav clicked")
    console.log("model name : ", modelName)
    return  {modelName} 
    //return params.dbname
    //return data
  } catch (error1) {
    console.log(error1)
    error(404, "Not found");
  }
}
