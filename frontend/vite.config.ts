import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    rolldownOptions: {
      output: {
        codeSplitting: {
          minSize: 60_000,
          maxSize: 450_000,
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom)[\\/]/, entriesAware: true, entriesAwareMergeThreshold: 60_000, includeDependenciesRecursively: false },
            { name: 'flow-vendor', test: /node_modules[\\/]@xyflow[\\/]/, entriesAware: true, entriesAwareMergeThreshold: 60_000, includeDependenciesRecursively: false },
            { name: 'mui-data-grid', test: /node_modules[\\/]@mui[\\/]x-data-grid[\\/]/, priority: 30, minSize: 60_000, maxSize: 450_000, entriesAware: true, entriesAwareMergeThreshold: 60_000, includeDependenciesRecursively: false },
            { name: 'amcharts', test: /node_modules[\\/]@amcharts[\\/]amcharts5[\\/]/, priority: 20, minSize: 60_000, maxSize: 550_000, entriesAware: true, entriesAwareMergeThreshold: 60_000, includeDependenciesRecursively: false },
            { name: 'mui-core', test: /node_modules[\\/](@emotion|@mui[\\/](?!x-data-grid))/, priority: 10, minSize: 60_000, maxSize: 450_000, entriesAware: true, entriesAwareMergeThreshold: 60_000, includeDependenciesRecursively: false },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
});
