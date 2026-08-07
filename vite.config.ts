import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const frontendPort = Number(env.FRONTEND_PORT || 3000);
    const allowedHosts = (env.ALLOWED_HOSTS || 'localhost')
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean);

    const appEnv = (env.VITE_APP_ENV || env.APP_ENV || mode || 'development').toLowerCase();
    const noIndex = env.VITE_NOINDEX === 'true' || appEnv === 'staging' || appEnv === 'dev';

    return {
      server: {
        host: env.FRONTEND_HOST || 'localhost',
        allowedHosts,
        port: frontendPort,
        strictPort: true,
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'import.meta.env.VITE_APP_ENV': JSON.stringify(appEnv),
        'import.meta.env.VITE_NOINDEX': JSON.stringify(noIndex ? 'true' : 'false'),
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
      },
      plugins: [
        {
          name: 'crm-html-env',
          transformIndexHtml(html) {
            if (!noIndex) return html;
            if (html.includes('name="robots"')) return html;
            return html.replace(
              /<head>/i,
              '<head>\n    <meta name="robots" content="noindex, nofollow, noarchive" />\n    <meta name="googlebot" content="noindex, nofollow, noarchive" />'
            );
          },
        },
      ],
    };
});
