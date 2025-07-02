import { mdsvex } from 'mdsvex';
import adapter from '@sveltejs/adapter-static';
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
      fallback:"index.html"
    }),
    // If you want to configure paths or other kit options, add here
  }
};

export default config;