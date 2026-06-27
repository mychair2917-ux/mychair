import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { defineConfig, loadEnv } from 'vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const proxyTarget =
    env.VITE_PROXY_TARGET ||
    (env.VITE_API_BASE_URL?.startsWith('http') ? new URL(env.VITE_API_BASE_URL).origin : undefined);

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 3000,
      host: true, // Listen on all interfaces to make it accessible outside Docker
      watch: {
        usePolling: env.VITE_USE_POLLING === 'true',
      },
      proxy: proxyTarget
        ? {
            '/api/v1': {
              target: proxyTarget,
              changeOrigin: true,
              secure: false,
              ws: true,
            },
          }
        : undefined,
    },
  };
});
