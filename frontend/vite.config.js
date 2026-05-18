// vite.config.js
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react' // <--- ADD THIS IMPORT

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(), // <--- ADD THIS TO PLUGINS
  ],
  server: {
    proxy: {
      // 🟢 PROXY: Any request starting with /api goes to port 5000
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})