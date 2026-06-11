import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { defineConfig, loadEnv } from 'vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 3000,
      host: true, // Listen on all interfaces to make it accessible outside Docker
      watch: {
        usePolling: env.VITE_USE_POLLING === 'true',
      },
      proxy: {
        '/api/v1': {
          target: env.VITE_PROXY_TARGET || 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
          ws: true, // Proxy websockets
        },
      },
    },
  };
});
