import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 5173 is Vite's default and what the backend's CORS_ORIGIN example expects.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    // The largest chunk is the lazily loaded edit form (~700 kB, ~150 kB gzipped), almost all of it
    // google-libphonenumber's metadata, which can't be split further. Everything on first load is
    // well under this.
    chunkSizeWarningLimit: 750,
    rolldownOptions: {
      output: {
        codeSplitting: {
          // React, Redux and the router change rarely: their own chunk stays cached across deploys
          groups: [
            {
              name: 'react-vendor',
              test: /node_modules[\\/](react|react-dom|scheduler|react-redux|@reduxjs|redux|immer|reselect|react-router|react-router-dom)[\\/]/,
            },
          ],
        },
      },
      onwarn(warning, defaultHandler) {
        // google-libphonenumber's prebuilt bundle uses direct eval; nothing we can change, and it
        // only loads with the edit form
        if (warning.code === 'EVAL' && warning.id?.includes('google-libphonenumber')) return;
        defaultHandler(warning);
      },
    },
  },
});
