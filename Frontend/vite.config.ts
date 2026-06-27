import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { defineConfig, loadEnv } from 'vite';

function resolveProxyTarget(env: Record<string, string>): string | undefined {
  if (env.VITE_PROXY_TARGET) {
    return env.VITE_PROXY_TARGET;
  }
  const apiBaseUrl = env.VITE_API_BASE_URL;
  if (apiBaseUrl?.startsWith('http')) {
    return new URL(apiBaseUrl).origin;
  }
  return undefined;
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = resolveProxyTarget(env);

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
