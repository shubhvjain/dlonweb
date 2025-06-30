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
      name: 'Dlonwebjs',
      fileName: (format) =>
        format === 'es'
          ? 'index.mjs'
          : format === 'cjs'
          ? 'index.cjs'
          : 'index.umd.js',
      formats: ['es', 'umd','cjs'],
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
