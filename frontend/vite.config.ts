import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      '@babel/runtime/helpers/esm/extends',
      '@babel/runtime/helpers/esm/objectWithoutPropertiesLoose',
      '@mui/x-data-grid',
      '@mui/x-charts/BarChart',
      '@mui/x-charts/LineChart',
      '@mui/x-charts/ScatterChart'
    ]
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    watch: {
      usePolling: true
    }
  }
});
