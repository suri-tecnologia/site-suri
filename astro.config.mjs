import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://suritecnologia.com',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // CSP sem 'unsafe-inline': todo CSS vai para arquivo
    inlineStylesheets: 'never',
  },
});
