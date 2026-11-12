# site-suri

Site da SURI Tecnologia (`https://suritecnologia.com`), em Astro, publicado como HTML estático numa imagem nginx sem root.

- Desenvolver: `npm install` e `npm run dev`
- Testar: `npm test` (faz o build e testa o `dist/`)
- Conferir se dá para publicar: `npm run test:release` (falha enquanto houver pendências em `src/config/site.json`)
- Publicar: tag `vX.Y.Z` → o CI publica `ghcr.io/suri-tecnologia/site-suri:X.Y.Z`; depois, atualizar o tag em `suri-infra/stacks/sites/compose.yaml`.
- Políticas: `src/content/politicas/`. Nova versão = arquivo novo (`app-v1-1.md`), nunca editar uma versão publicada.
