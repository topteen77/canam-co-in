import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const frontendPort = Number(env.FRONTEND_PORT || 3000);
    const allowedHosts = (env.ALLOWED_HOSTS || 'localhost')
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean);

    return {
      server: {
        host: env.FRONTEND_HOST || 'localhost',
        allowedHosts,
        port: frontendPort,
        strictPort: true,
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          input: {
            main: './index.html',
            sw: './sw.js'
          }
        }
      }
    };
});
