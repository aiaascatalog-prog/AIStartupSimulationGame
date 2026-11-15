import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const isCrazyGamesBuild = process.env.VITE_PORTAL === 'crazygames';
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'inject-portal-sdk',
        transformIndexHtml(html) {
          if (!isCrazyGamesBuild) return html;
          return html.replace(
            '</head>',
            '    <script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>\n  </head>'
          );
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
