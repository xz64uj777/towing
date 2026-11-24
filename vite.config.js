import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/towing/' : '/',
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'three-core', test: /\/three\/build\/three\.core\.js$/, priority: 2 },
            { name: 'three-renderer', test: /\/three\/build\/three\.module\.js$/ },
          ],
        },
      },
    },
  },
});
