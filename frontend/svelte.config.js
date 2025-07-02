import { mdsvex } from 'mdsvex';
import adapter from '@sveltejs/adapter-netlify';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: ['.svelte', '.svx'],
  
  preprocess: [
    vitePreprocess(),
    mdsvex()
  ],

  kit: {
    adapter: adapter({
      edge: false,
      split: false
    }),
    // If you want to configure paths or other kit options, add here
  }
};

export default config;