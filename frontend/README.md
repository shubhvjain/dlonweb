# Frontend for DL on the web

This is the fronted application for DL on the web , build using [Svelte]( https://svelte.dev/docs/svelte/overview) and  [SvelteKit](https://svelte.dev/docs/kit/introduction)


## Getting started 

- Clone the main repo (since the `frontend` package depends on the `package`)
- `cd frontend` 
- Install all the required package `npm install`
- To run the app locally `npm run dev -- --open` (The --open flag automatically opens the app in your browser.)

## Manual Building 

- To create a production version of the app manually : `npm run build`
- You can preview the production build with `npm run preview`.

## Multilingual support  

(using translations files with same keys )

To use multilingual labels in any component 

Files are located [here](./static/locales/)

### Using Translations in a Component
```
<script>
  import { translations } from '$lib/store.js';
</script>

<p>{$translations.inference}</p>
```

### Managing translations 
- Translation files are located in the static/locales folder.
- When adding a new label, update it in all language files to maintain consistency. 


## App settings 
The [setting.js](./src/lib/utils/settings.js) script contains all the setting options for the app. These settings are divided into user and app settings.  User settings can be configured by the user while running the app. They are copied in the localstorage. These include settings like the default theme, default language of the app etc. App settings  can be configured by the developer before deploying the app on the server and cannot be changed while running the app. This includes settings like: option to toggle optional backend server usage

## Project structure 

The project follows the boilerplate Sveltekit project structure and was generated using the `npx sv create` command. See [link](https://svelte.dev/docs/kit/introduction) for more details. 

The following table describes how the internal app components. These exists inside the `src/lib` folder



```
frontend/
├── src/
│   ├── routes/          # App pages (SvelteKit file-based routing)
│   │   ├── +page.svelte # Main entry point for each route
│   │   ├── +layout.svelte # Layout wrappers for nested routes
│   │   └── about/         # About page
|   |   └── settings/      # Settings page 
|   |   └── convert/       # Page to convert .h5 models to tensorflow.js compatible
|   |   └── inference/     # Page to run prediction 
|   |   └── training/      # Page to run model training 
│   │
│   ├── lib/             # Shared utilities and modules
│   │   ├── components/  # Reusable UI components
│   │   ├── store.js     # Svelte stores (e.g., translations, state)
│   │   └── utils/       # Helper components
│   │
│   └── app.html         # Root HTML template
│
├── static/              # Static assets (images, translations, etc.)
│   └── locales/         # Translation files for multilingual support
│
├── package.json
└── ...
```


## Routes 

- `/` : The home page. Show details about the app including an introduction, features etc.
- `/about` : Same as the home page
- `/inference` : The inference page. The model can be selected using a dropdown that lists all the models available in the library 
  - `/inference/model_name` : The inference page with a selected model. No other model can be selected only the model id specified in the url
- `/library` : shows the list of available  models and details including the examples of input and output it generates 
- `/settings` : the user setting page. Allows users to edit settings such as url to the optional backed server
- `/training` : To be integrated in the future 
- `/convert` :  A utility available using the backend server. Allows users to convert their `.h5` models into browser runnable format. 




