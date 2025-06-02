import { defineConfig } from 'vite';

export default defineConfig({
  assetsInclude: ['**/*.wasm'],
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  build: {
    lib: {
      entry: 'src/index.js',
      name: 'DLOnWeb',
      fileName: 'dl-on-web',
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: ['@tensorflow/tfjs' ,"@ffmpeg/ffmpeg", "@ffmpeg/util"], // Don't bundle TensorFlow itself
      output: {
        globals: {
          '@tensorflow/tfjs': 'tf',
        },
      },
    },
  },
});
