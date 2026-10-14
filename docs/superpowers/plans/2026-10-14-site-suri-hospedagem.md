# Site SURI + hospedagem portátil — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar o site estático da SURI em `https://suritecnologia.com` (com as páginas legais do app) a partir de uma stack Docker portátil, gerida por git, rodando no Portainer do servidor 192.168.2.50.

**Architecture:** Dois repositórios na organização `suri-tecnologia`: `site-suri` (Astro → HTML estático → imagem nginx sem root, publicada no GHCR pelo GitHub Actions) e `suri-infra` (Caddy interno com cabeçalhos de segurança + compose das stacks, implantados pelo Portainer direto do git). A cadeia de entrada é Cloudflare → OPNsense (TLS + naxsi) → Caddy da SURI (porta 8088, aceita só o IP do OPNsense) → container do site na rede `suri-net`.

**Tech Stack:** Astro 7.3.8, TypeScript, Vitest 5.0.4, node-html-parser 9.0.4, @fontsource (Sora, IBM Plex Sans) 5.3.0, nginx-unprivileged 1.31.6-alpine, Caddy 2.11.7-alpine, Docker Compose, Portainer CE 2.45 (GitOps), GitHub Actions, GHCR, Trivy 0.75.0, Dependabot.

**Spec:** `docs/superpowers/specs/2026-10-14-site-suri-hospedagem-design.md`

## Achados da preparação (14/10/2026) e desvios da spec

Levantados antes de escrever este plano, com leitura direta no servidor, no OPNsense e no DNS:

1. **O DNS de `suritecnologia.com` está na Cloudflare** (nameservers `clint`/`connie.ns.cloudflare.com`, registros com proxy). O domínio raiz mostra hoje a página de "domínio estacionado" da Hostinger. Os subdomínios (`chatwoot`, `n8n`, `portainer`) passam por Cloudflare → OPNsense. **Consequência:** a cadeia real é Cloudflare → OPNsense → Caddy. A pendência "o que o domínio raiz resolve" (spec §8) está resolvida: é preciso trocar o registro raiz na Cloudflare (Task 11).
2. **O Portainer estava exposto na internet** em `portainer.suritecnologia.com` (vhost no nginx do OPNsense → 192.168.2.50:9000). A spec (§5.4) supunha o contrário. **Decisão do usuário em 14/10/2026:** retirar o acesso público e manter só o acesso interno. No mesmo dia, o **n8n**, sem uso, foi parado (`docker stop` + `restart=no`, dados preservados em `/root/n8n/` e backup de 07/10 em `~/n8n_backup_20261007/`). A retirada dos vhosts e dos registros DNS dos dois é a Task 0.
7. **A WAN do OPNsense aceita 80 e 443 de qualquer origem** (`pass in quick on re0 ... from any to (self) port = https`). Quem souber o IP do cartório chega aos serviços sem passar pela Cloudflare. A correção (aceitar só as faixas da Cloudflare) entra na Task 11. Há também uma liberação de `8080` (http-alt) de qualquer origem na WAN, fora do escopo deste plano e registrada para investigação.
3. **O OPNsense emite os certificados pelo ACME Client (Let's Encrypt)**, um por host, com vencimento em 25/11/2026. Os vhosts são criados no plugin nginx pela interface web.
4. **Na conta Free do GitHub, repositórios privados não têm proteção de branch.** Desvio da spec (§3.1, §5.4): `site-suri` passa a ser **público**. O site é público por natureza, não há segredo no repositório, e o histórico das políticas fica auditável por qualquer pessoa. A imagem dele no GHCR também é pública. `suri-infra` continua **privado e sem proteção de branch**; o risco fica registrado no README dele.
5. **Não há Docker neste PC.** Tudo que precisa de Docker roda no GitHub Actions. Isso atende o critério de aceite 5 (ensaio de portabilidade): cada execução do CI sobe a stack do zero num runner limpo, só a partir do git, com os mesmos comandos do runbook.
6. **Porta livre no servidor:** 8088 (hoje estão em uso 22, 3000, 5678, 9000 e 9443, além de 5432 e 6379 em loopback). Há 39 GB livres no disco.

## Global Constraints

- Idioma de todo texto visível: português do Brasil, com acentuação completa.
- Node `>=22.12.0` (exigência do Astro 7). Versões exatas das dependências (`npm install -E`).
- Imagens base fixadas por **digest**:
  - `node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402`
  - `nginxinc/nginx-unprivileged:1.31.6-alpine@sha256:884e0b7f42f303641b0f4e78755aea647521dca0b89ca3be7992ad78b5c07434`
  - `caddy:2.11.7-alpine@sha256:d8542f48d34a9cf4e4c11a478865229840e87e4c96ea3f439101f31a5d35f75f`
  - `aquasec/trivy:0.75.0@sha256:af6acf9a6b85dfe389a1941505c0ce9efef52a4719635e1a962f022a3d855daa`
  - `alpine:3.24.2@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6`
- Actions fixadas por SHA: `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1` (v7.0.1), `actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1` (v7.1.0). Nenhuma outra action de terceiros; login, build e push são feitos com o CLI do `docker`.
- Deploy só por tag explícita; nunca `latest` em produção. O tag `main` da imagem do site existe só para o CI do `suri-infra`.
- HTML gerado: sem `<script>`, sem `<style>`, sem atributo `style=`, sem recurso externo (fontes, imagens, CSS). É o que permite a CSP `default-src 'self'` sem `unsafe-inline`.
- Rotas com barra final (`trailingSlash: 'always'`). A URL da política para as lojas é `https://suritecnologia.com/apps/<slug>/privacidade/`.
- Containers: `read_only`, `cap_drop: [ALL]`, `no-new-privileges`, limites de CPU e memória, nenhuma porta no host exceto a do Caddy.
- Nenhum segredo em git. Tokens só no Portainer e nos Secrets do GitHub.
- Arquivos `.sh` com fim de linha LF (`.gitattributes`) e bit de execução no git.
- Mudanças no servidor 192.168.2.50, no OPNsense e na Cloudflare só com confirmação explícita do usuário no chat, no momento de executar. O acesso SSH do Claude ao servidor e ao OPNsense é só para leitura e verificação.
- **Deploy manual enquanto estivermos no servidor do cartório** (decisão de 14/10/2026): as stacks do Portainer ficam **sem** atualização automática (GitOps polling desligado). Um push no GitHub, sozinho, nunca chega ao servidor; cada deploy é um clique em *Pull and redeploy*. Na VPS da SURI, o polling pode ser religado.
- **O Portainer só é acessado pela rede interna** (`https://192.168.2.50:9443`). O acesso público foi retirado em 14/10/2026.

## Review Focus

1. **Data de vigência um dia antes por causa do fuso:** `vigente_desde: 2026-10-14` deve aparecer como "14/10/2026", nunca "13/10/2026". O teste fica na Task 2 (`formatarData` em UTC).
2. **Versão com data futura publicada como vigente:** uma política com `vigente_desde` posterior ao dia do build não pode aparecer como vigente. O teste fica na Task 2 (`escolherVigente`).
3. **Cloudflare injetando script:** recursos como Email Obfuscation e Web Analytics inserem scripts. Isso quebra a CSP e contradiz a política ("o site não usa scripts de terceiros"). A verificação fica na Task 12, procurando `cdn-cgi`, `email-protection` e `cloudflareinsights` no HTML servido.
4. **Redirecionamento do nginx vazando a porta interna:** `/privacidade` sem barra deve redirecionar para `/privacidade/` no mesmo host e porta, nunca para `:8080`. O teste fica na Task 6 (smoke do container).
5. **Requisição que chega ao Caddy sem passar pelo OPNsense:** um acesso direto pela rede local, que pularia o WAF, deve receber 403. O teste fica na Task 7 (smoke) e é repetido no servidor na Task 10.

---

## Mapa de arquivos

**`C:\projetos_claude\site_SURI` → repositório `suri-tecnologia/site-suri` (público)**

| Arquivo | Responsabilidade |
|---|---|
| `package.json`, `package-lock.json`, `astro.config.mjs`, `tsconfig.json` | projeto Astro |
| `vitest.config.ts`, `vitest.release.config.ts` | testes do dia a dia / checagem de publicação |
| `.gitattributes`, `.gitignore`, `.dockerignore` | higiene do repositório |
| `src/config/site.json` | dados editáveis: contato, encarregado, nome/slug do app |
| `src/site.config.ts` | tipos + `pendencias()` (o que falta para publicar) |
| `src/lib/versao.ts` | regras puras de versão e data das políticas |
| `src/lib/politicas.ts` | consulta à coleção de políticas (usa `astro:content`) |
| `src/content.config.ts` | esquemas das coleções `politicas` e `cartorios` |
| `src/content/politicas/app-v1-0.md`, `suri-v1-0.md` | textos das políticas |
| `src/content/cartorios/risma.md` | anexo do RISMA |
| `src/styles/global.css` | tokens da marca e estilos base |
| `src/assets/logo-horizontal.svg`, `public/favicon.svg` | marca (copiados da identidade v1.0.0) |
| `src/layouts/Base.astro` | casca HTML de todas as páginas |
| `src/components/Politica.astro`, `AnexoCartorios.astro`, `Contato.astro`, `Encarregado.astro` | blocos reutilizáveis |
| `src/pages/**` | as 7 rotas + versões + 404 |
| `tests/helpers/dist.ts`, `tests/helpers/rotas.ts` | leitura do `dist/` |
| `tests/*.test.ts`, `tests/release/release.test.ts` | testes |
| `nginx/default.conf`, `Dockerfile`, `scripts/smoke-container.sh` | imagem e teste dela |
| `.github/workflows/ci.yml`, `.github/dependabot.yml` | CI e atualizações |

**`C:\projetos_claude\suri-infra` → repositório `suri-tecnologia/suri-infra` (privado)**

| Arquivo | Responsabilidade |
|---|---|
| `proxy/Caddyfile`, `proxy/Dockerfile`, `proxy/compose.yaml` | porta de entrada da SURI |
| `stacks/sites/compose.yaml` | stack do site |
| `stacks/app-risma/README.md` | lugar reservado para o backend do app |
| `backup/backup-volume.sh`, `backup/restore-volume.sh` | backup de volumes nomeados |
| `tests/smoke.sh`, `tests/backup.sh`, `tests/compose.proxy.ci.yaml`, `tests/compose.sites.ci.yaml` | testes no CI |
| `docs/subir-do-zero.md`, `docs/migrar-para-vps.md`, `docs/rollback.md`, `docs/aceite.md` | runbooks e registro do aceite |
| `README.md`, `.gitattributes`, `.github/workflows/ci.yml`, `.github/dependabot.yml` | repositório e CI |

---

### Task 0: Retirar o acesso público de n8n e Portainer

Mudanças no OPNsense e na Cloudflare: **o usuário executa**, e o Claude verifica. Pode rodar em paralelo às Tasks 1 a 8.

- [ ] **Step 1: OPNsense (usuário)**

Em *Services → Nginx → Configuration → HTTP(S) → HTTP Server*, **desativar** (não apagar, para poder voltar) os servidores `n8n.suritecnologia.com` e `portainer.suritecnologia.com`. Depois, *Apply*. Em *Services → ACME Client → Certificates*, desativar a renovação dos dois certificados.

- [ ] **Step 2: Cloudflare (usuário)**

Em *DNS*, apagar os registros `n8n` e `portainer`.

- [ ] **Step 3: Verificar (Claude)**

```bash
for h in n8n portainer; do curl -s -o /dev/null -m 15 -w "$h: %{http_code}\n" "https://$h.suritecnologia.com/"; done
curl -sk -o /dev/null -m 10 -w 'Portainer interno: %{http_code}\n' https://192.168.2.50:9443/
```
Expected: `n8n: 000` e `portainer: 000` (nome não resolve mais); `Portainer interno: 200`.

- [ ] **Step 4: Apagar o n8n de vez (a partir de 13/11/2026, se nada fez falta)**

Confirmar com o usuário. Então, no servidor: remover os containers `n8n-n8n-1` e `n8n-postgres-1` e as imagens, e apagar `/root/n8n/` só depois de copiar `~/n8n_backup_20261007/` para fora do servidor. Com isso, a pendência das senhas vazadas do n8n deixa de existir.

---

### Task 1: Base do projeto Astro, harness de testes e layout com a marca

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `.gitattributes`
- Create: `src/styles/global.css`, `src/assets/logo-horizontal.svg`, `public/favicon.svg`
- Create: `src/config/site.json`, `src/site.config.ts` (versão mínima; a Task 2 completa)
- Create: `src/layouts/Base.astro`, `src/pages/index.astro`
- Test: `tests/helpers/dist.ts`, `tests/base.test.ts`

**Interfaces:**
- Produces: `Base.astro` com props `{ titulo: string; descricao: string; indexar?: boolean }`; `SITE` e `APP` exportados de `src/site.config.ts`; helpers `DIST`, `arquivoDaRota(rota)`, `pagina(rota): HTMLElement`, `arquivos(ext): string[]`, `rotaDoArquivo(arquivo): string`; atributo `data-versao` no `<html>` com a versão do `package.json`.

- [ ] **Step 1: Criar os arquivos do projeto**

`package.json`:
```json
{
  "name": "site-suri",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.12.0" },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "test": "astro build && vitest run",
    "test:release": "astro build && vitest run --config vitest.release.config.ts"
  }
}
```

`astro.config.mjs`:
```js
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
```

`tsconfig.json`:
```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": { "resolveJsonModule": true },
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/release/**', 'node_modules/**'],
  },
});
```

`.gitignore`:
```
node_modules/
dist/
.astro/
```

`.gitattributes`:
```
* text=auto eol=lf
*.svg text eol=lf
*.woff2 binary
```

- [ ] **Step 2: Instalar as dependências com versão exata**

Run (na pasta `C:\projetos_claude\site_SURI`):
```bash
npm install -E astro@7.3.8 @fontsource/sora@5.3.0 @fontsource/ibm-plex-sans@5.3.0
npm install -E -D vitest@5.0.4 node-html-parser@9.0.4
```
Expected: `package-lock.json` criado, sem `ERR!`.

- [ ] **Step 3: Copiar os arquivos da marca**

```bash
mkdir -p src/assets public
cp "/c/projetos_claude/identidade visual SURI/versions/horizontal.svg" src/assets/logo-horizontal.svg
cp "/c/projetos_claude/identidade visual SURI/applications/favicon.svg" public/favicon.svg
```

- [ ] **Step 4: Escrever o helper e o teste que falha**

`tests/helpers/dist.ts`:
```ts
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parse, type HTMLElement } from 'node-html-parser';

export const DIST = join(process.cwd(), 'dist');

export function arquivoDaRota(rota: string): string {
  const limpa = decodeURIComponent(rota.split('#')[0].split('?')[0]);
  return join(DIST, limpa.endsWith('/') ? `${limpa}index.html` : limpa);
}

export function pagina(rota: string): HTMLElement {
  const arquivo = arquivoDaRota(rota);
  if (!existsSync(arquivo)) throw new Error(`página não gerada: ${rota} (esperado ${arquivo})`);
  return parse(readFileSync(arquivo, 'utf8'));
}

export function arquivos(extensao: string, dir: string = DIST): string[] {
  if (!existsSync(dir)) throw new Error(`pasta ${dir} não existe — rode "npm test", que faz o build antes`);
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) saida.push(...arquivos(extensao, caminho));
    else if (caminho.endsWith(extensao)) saida.push(caminho);
  }
  return saida;
}

export function rotaDoArquivo(arquivo: string): string {
  const relativo = relative(DIST, arquivo).split(sep).join('/');
  return `/${relativo.replace(/index\.html$/, '')}`;
}
```

`tests/base.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { arquivos, pagina } from './helpers/dist';

const versao = JSON.parse(readFileSync('package.json', 'utf8')).version;

describe('casca das páginas', () => {
  it('home existe em pt-BR, com a versão do site no <html>', () => {
    const html = pagina('/').querySelector('html')!;
    expect(html.getAttribute('lang')).toBe('pt-BR');
    expect(html.getAttribute('data-versao')).toBe(versao);
  });

  it('home tem título, descrição, um único h1 e o logo inline', () => {
    const doc = pagina('/');
    expect(doc.querySelector('title')?.text).toBe('SURI Tecnologia');
    expect(doc.querySelector('meta[name="description"]')?.getAttribute('content')?.length).toBeGreaterThan(20);
    expect(doc.querySelectorAll('h1')).toHaveLength(1);
    expect(doc.querySelector('header .marca svg')).not.toBeNull();
  });

  it('fontes da marca são servidas pelo próprio site', () => {
    const woff2 = arquivos('.woff2');
    expect(woff2.some((f) => /sora/i.test(f))).toBe(true);
    expect(woff2.some((f) => /ibm-plex-sans/i.test(f))).toBe(true);
  });
});
```

- [ ] **Step 5: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL. O build falha (não há páginas) ou o teste acusa `página não gerada: /`.

- [ ] **Step 6: Escrever config mínima, estilos, layout e home**

`src/config/site.json`:
```json
{
  "nome": "SURI Tecnologia",
  "url": "https://suritecnologia.com",
  "contato": { "email": null, "whatsapp": null },
  "encarregado": null,
  "app": { "slug": "acompanhe", "nome": "Acompanhe", "nomeDefinitivo": false }
}
```

`src/site.config.ts`:
```ts
import dados from './config/site.json';

export interface Encarregado {
  nome: string;
  email: string;
}

export interface ConfigSite {
  nome: string;
  url: string;
  contato: { email: string | null; whatsapp: string | null };
  encarregado: Encarregado | null;
  app: { slug: string; nome: string; nomeDefinitivo: boolean };
}

export const SITE: ConfigSite = dados as ConfigSite;
export const APP = SITE.app;
```

`src/styles/global.css`:
```css
/* Tokens: paleta A da identidade SURI v1.0.0 (identidade visual SURI/colors/palette-a.css) */
:root {
  --color-primary: #0B2A5B;
  --color-secondary: #1F5FA8;
  --color-accent: #17A8C1;
  --color-neutral-100: #F1F4F8;
  --color-neutral-300: #CAD3DF;
  --color-neutral-500: #667385;
  --color-neutral-700: #344055;
  --color-neutral-900: #0F1826;
  --color-bg: #FFFFFF;
  --color-fg: #0F1826;
  --font-titulo: 'Sora', system-ui, sans-serif;
  --font-texto: 'IBM Plex Sans', system-ui, sans-serif;
  --largura: 72rem;
}

*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  font-family: var(--font-texto);
  font-size: 1rem;
  line-height: 1.6;
  color: var(--color-fg);
  background: var(--color-bg);
}

h1, h2, h3, h4 { font-family: var(--font-titulo); color: var(--color-primary); }
h1 { font-size: 2.44rem; line-height: 1.15; font-weight: 700; letter-spacing: -0.015em; }
h2 { font-size: 1.95rem; line-height: 1.2; font-weight: 600; letter-spacing: -0.01em; margin-top: 2.5rem; }
h3 { font-size: 1.56rem; line-height: 1.3; font-weight: 600; }

a { color: var(--color-secondary); }
a:focus-visible { outline: 3px solid var(--color-accent); outline-offset: 2px; }

.pular { position: absolute; left: -999px; }
.pular:focus { left: 1rem; top: 1rem; background: var(--color-bg); padding: 0.5rem 1rem; }

.topo, .rodape, main { max-width: var(--largura); margin: 0 auto; padding: 1.5rem; }
.topo { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
.topo nav, .rodape nav { display: flex; gap: 1.25rem; flex-wrap: wrap; }
.marca { color: var(--color-primary); display: inline-block; width: 10rem; }
.marca svg { width: 100%; height: auto; display: block; }
.rodape { border-top: 1px solid var(--color-neutral-300); color: var(--color-neutral-700); font-size: 0.875rem; }

.aviso { border-left: 4px solid var(--color-accent); background: var(--color-neutral-100); padding: 0.75rem 1rem; }
.meta-politica { color: var(--color-neutral-700); font-size: 0.875rem; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid var(--color-neutral-300); padding: 0.5rem; text-align: left; vertical-align: top; }
```

`src/layouts/Base.astro`:
```astro
---
import '@fontsource/sora/latin-400.css';
import '@fontsource/sora/latin-600.css';
import '@fontsource/sora/latin-700.css';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-400-italic.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '../styles/global.css';
import logo from '../assets/logo-horizontal.svg?raw';
import pacote from '../../package.json';
import { APP, SITE } from '../site.config';

interface Props {
  titulo: string;
  descricao: string;
  indexar?: boolean;
}

const { titulo, descricao, indexar = true } = Astro.props;
const tituloCompleto = titulo === SITE.nome ? titulo : `${titulo} | ${SITE.nome}`;
---
<!doctype html>
<html lang="pt-BR" data-versao={pacote.version}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{tituloCompleto}</title>
    <meta name="description" content={descricao} />
    {!indexar && <meta name="robots" content="noindex" />}
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  </head>
  <body>
    <a class="pular" href="#conteudo">Pular para o conteúdo</a>
    <header class="topo">
      <a class="marca" href="/" aria-label="SURI Tecnologia — início"><Fragment set:html={logo} /></a>
      <nav aria-label="Principal">
        <a href={`/apps/${APP.slug}/`}>App {APP.nome}</a>
        <a href="/lgpd/">LGPD</a>
      </nav>
    </header>
    <main id="conteudo">
      <slot />
    </main>
    <footer class="rodape">
      <p>© {new Date().getUTCFullYear()} {SITE.nome}</p>
      <nav aria-label="Rodapé">
        <a href="/privacidade/">Política de privacidade</a>
        <a href="/lgpd/">Seus direitos (LGPD)</a>
      </nav>
    </footer>
  </body>
</html>
```

`src/pages/index.astro`:
```astro
---
import Base from '../layouts/Base.astro';
import { APP, SITE } from '../site.config';
---
<Base titulo={SITE.nome} descricao="A SURI Tecnologia desenvolve soluções digitais para cartórios: apps, automação e infraestrutura segura, com proteção de dados desde o projeto.">
  <h1>Tecnologia para cartórios, com segurança e respeito aos dados</h1>
  <p>
    A SURI Tecnologia desenvolve soluções digitais para serventias extrajudiciais:
    aplicativos para o cidadão acompanhar seus pedidos, automação do atendimento
    e infraestrutura segura. Cada solução nasce com a LGPD no projeto, não como remendo.
  </p>
  <h2>App {APP.nome}</h2>
  <p>
    O cliente do cartório acompanha a situação do seu pedido de registro ou de certidão
    e recebe um aviso a cada nova etapa, sem cadastro e sem informar dados pessoais.
  </p>
  <p><a href={`/apps/${APP.slug}/`}>Conheça o app {APP.nome}</a></p>
</Base>
```

- [ ] **Step 7: Rodar e ver passar**

Run: `npm test`
Expected: PASS nos 3 testes de `tests/base.test.ts`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: base do site SURI em Astro com layout da marca e testes sobre o build"
```

---

### Task 2: Configuração do site e regras de versão das políticas

**Files:**
- Modify: `src/site.config.ts` (acrescentar `pendencias`)
- Create: `src/lib/versao.ts`
- Create: `vitest.release.config.ts`, `tests/release/release.test.ts`
- Test: `tests/versao.test.ts`, `tests/config.test.ts`

**Interfaces:**
- Consumes: `ConfigSite`, `SITE` (Task 1).
- Produces: `pendencias(cfg?: ConfigSite): string[]`; `compararVersao(a: string, b: string): number`; `ordenarMaisNovaPrimeiro<T extends { data: DadosVersao }>(lista: T[]): T[]`; `escolherVigente<T extends { data: DadosVersao }>(lista: T[], agora: Date): T`; `verificarVersoesUnicas(lista: { data: DadosVersao }[]): void`; `formatarData(data: Date): string`; `interface DadosVersao { versao: string; vigente_desde: Date }`.

- [ ] **Step 1: Escrever os testes que falham**

`tests/versao.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  compararVersao, escolherVigente, formatarData, ordenarMaisNovaPrimeiro, verificarVersoesUnicas,
} from '../src/lib/versao';

const v = (versao: string, data: string) => ({ id: versao, data: { versao, vigente_desde: new Date(data) } });

describe('compararVersao', () => {
  it('compara numericamente, não como texto (1.10 > 1.9)', () => {
    expect(compararVersao('1.10', '1.9')).toBeGreaterThan(0);
    expect(compararVersao('2.0', '1.9')).toBeGreaterThan(0);
    expect(compararVersao('1.0', '1.0')).toBe(0);
  });
});

describe('escolherVigente', () => {
  const lista = [v('1.0', '2026-10-14'), v('1.1', '2026-11-01'), v('2.0', '2027-01-01')];

  it('escolhe a versão mais nova já em vigor', () => {
    expect(escolherVigente(lista, new Date('2026-12-01T12:00:00Z')).data.versao).toBe('1.1');
  });

  it('ignora versão com data futura', () => {
    expect(escolherVigente(lista, new Date('2026-10-20T12:00:00Z')).data.versao).toBe('1.0');
  });

  it('falha se nenhuma versão está em vigor na data do build', () => {
    expect(() => escolherVigente(lista, new Date('2026-01-01T12:00:00Z'))).toThrow(/nenhuma versão/);
  });

  it('ordena da mais nova para a mais antiga', () => {
    expect(ordenarMaisNovaPrimeiro(lista).map((e) => e.data.versao)).toEqual(['2.0', '1.1', '1.0']);
  });
});

describe('verificarVersoesUnicas', () => {
  it('rejeita duas entradas com a mesma versão', () => {
    expect(() => verificarVersoesUnicas([v('1.0', '2026-10-14'), v('1.0', '2026-11-01')])).toThrow(/duplicada/);
  });
});

describe('formatarData', () => {
  it('mostra a data do frontmatter sem voltar um dia por causa do fuso', () => {
    expect(formatarData(new Date('2026-10-14'))).toBe('14/10/2026');
  });
});
```

`tests/config.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { pendencias, type ConfigSite } from '../src/site.config';

const completa: ConfigSite = {
  nome: 'SURI Tecnologia',
  url: 'https://suritecnologia.com',
  contato: { email: 'contato@suritecnologia.com', whatsapp: '5555999999999' },
  encarregado: { nome: 'Fulana de Tal', email: 'dpo@suritecnologia.com' },
  app: { slug: 'meu-app', nome: 'Meu App', nomeDefinitivo: true },
};

describe('pendencias', () => {
  it('não acusa nada numa configuração completa', () => {
    expect(pendencias(completa)).toEqual([]);
  });

  it('acusa nome provisório, encarregado e contato ausentes', () => {
    const p = pendencias({ ...completa, contato: { email: null, whatsapp: null }, encarregado: null, app: { ...completa.app, nomeDefinitivo: false } });
    expect(p).toHaveLength(3);
  });

  it('acusa e-mail inválido, WhatsApp fora do formato e slug com maiúscula', () => {
    const p = pendencias({
      ...completa,
      contato: { email: 'contato@', whatsapp: '(55) 9999-9999' },
      app: { ...completa.app, slug: 'Meu_App' },
    });
    expect(p.join(' | ')).toMatch(/contato inválido/);
    expect(p.join(' | ')).toMatch(/WhatsApp/);
    expect(p.join(' | ')).toMatch(/slug/);
  });

  it('aceita WhatsApp ausente (é opcional)', () => {
    expect(pendencias({ ...completa, contato: { ...completa.contato, whatsapp: null } })).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL com `Failed to resolve import "../src/lib/versao"` e `pendencias is not a function`.

- [ ] **Step 3: Implementar**

`src/lib/versao.ts`:
```ts
// Regras puras de versão das políticas (sem astro:content, para serem testáveis no Vitest).

export interface DadosVersao {
  versao: string;
  vigente_desde: Date;
}

export function compararVersao(a: string, b: string): number {
  const [aMaior, aMenor] = a.split('.').map(Number);
  const [bMaior, bMenor] = b.split('.').map(Number);
  return aMaior - bMaior || aMenor - bMenor;
}

export function ordenarMaisNovaPrimeiro<T extends { data: DadosVersao }>(lista: T[]): T[] {
  return [...lista].sort((x, y) => compararVersao(y.data.versao, x.data.versao));
}

export function escolherVigente<T extends { data: DadosVersao }>(lista: T[], agora: Date): T {
  const vigente = ordenarMaisNovaPrimeiro(lista).find((e) => e.data.vigente_desde.getTime() <= agora.getTime());
  if (!vigente) {
    throw new Error('nenhuma versão da política está vigente na data do build — confira vigente_desde');
  }
  return vigente;
}

export function verificarVersoesUnicas(lista: { data: DadosVersao }[]): void {
  const vistas = new Set<string>();
  for (const entrada of lista) {
    if (vistas.has(entrada.data.versao)) throw new Error(`versão duplicada: ${entrada.data.versao}`);
    vistas.add(entrada.data.versao);
  }
}

// Datas do frontmatter chegam como meia-noite UTC; formatar em UTC evita mostrar o dia anterior no Brasil.
export function formatarData(data: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(data);
}
```

Acrescentar ao final de `src/site.config.ts`:
```ts
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// O que ainda impede publicar uma versão (tag v*) do site. Vazio = pode publicar.
export function pendencias(cfg: ConfigSite = SITE): string[] {
  const p: string[] = [];
  if (!cfg.app.nomeDefinitivo) p.push('nome definitivo do app (app.nome / app.slug em src/config/site.json)');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(cfg.app.slug)) p.push(`slug do app inválido: "${cfg.app.slug}"`);
  if (!cfg.encarregado) p.push('encarregado (DPO) da SURI');
  else if (!EMAIL.test(cfg.encarregado.email)) p.push('e-mail do encarregado inválido');
  if (!cfg.contato.email) p.push('e-mail de contato da SURI');
  else if (!EMAIL.test(cfg.contato.email)) p.push('e-mail de contato inválido');
  if (cfg.contato.whatsapp !== null && !/^\d{12,13}$/.test(cfg.contato.whatsapp)) {
    p.push('WhatsApp deve ter só dígitos, com DDI e DDD (ex.: 5555999999999)');
  }
  return p;
}
```

`vitest.release.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/release/**/*.test.ts'] },
});
```

`tests/release/release.test.ts`:
```ts
import { expect, it } from 'vitest';
import { pendencias } from '../../src/site.config';

it('nada pendente para publicar uma versão do site', () => {
  expect(pendencias()).toEqual([]);
});
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS em `versao.test.ts`, `config.test.ts` e `base.test.ts`.

Run: `npm run test:release`
Expected: FAIL listando 3 pendências (nome do app, encarregado, e-mail). Esse é o comportamento correto até a Task 9.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: regras de versão das políticas e checagem de pendências para publicar"
```

---

### Task 3: Políticas versionadas, anexo por cartório e textos v1.0

**Files:**
- Create: `src/content.config.ts`, `src/lib/politicas.ts`
- Create: `src/components/Politica.astro`, `src/components/AnexoCartorios.astro`, `src/components/Encarregado.astro`, `src/components/Contato.astro`
- Create: `src/content/politicas/app-v1-0.md`, `src/content/politicas/suri-v1-0.md`, `src/content/cartorios/risma.md`
- Create: `src/pages/apps/[app]/privacidade/index.astro`, `src/pages/apps/[app]/privacidade/[versao].astro`
- Create: `src/pages/privacidade/index.astro`, `src/pages/privacidade/[versao].astro`
- Create: `tests/helpers/rotas.ts`
- Test: `tests/politicas.test.ts`

**Interfaces:**
- Consumes: `escolherVigente`, `ordenarMaisNovaPrimeiro`, `verificarVersoesUnicas`, `formatarData` (Task 2); `SITE`, `APP` (Task 1); `Base.astro` (Task 1).
- Produces: `versoes(documento: 'app' | 'suri'): Promise<Politica[]>` (mais nova primeiro); componentes `<Politica entrada vigente historico base>` (com `<slot/>` antes do histórico), `<AnexoCartorios/>`, `<Encarregado/>` (elemento com `data-encarregado`), `<Contato/>` (elemento com `data-contato`); `ROTAS` em `tests/helpers/rotas.ts`; classes CSS `aviso-minuta`, `aviso-antiga`, `meta-politica`, `historico`, `anexo`.

- [ ] **Step 1: Escrever o teste que falha**

`tests/helpers/rotas.ts`:
```ts
import { APP } from '../../src/site.config';

export const ROTAS = [
  '/',
  `/apps/${APP.slug}/`,
  `/apps/${APP.slug}/privacidade/`,
  `/apps/${APP.slug}/suporte/`,
  `/apps/${APP.slug}/excluir-dados/`,
  '/privacidade/',
  '/lgpd/',
] as const;
```

`tests/politicas.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { APP } from '../src/site.config';
import { pagina } from './helpers/dist';

const app = `/apps/${APP.slug}/privacidade/`;

describe.each([
  ['política do app', app],
  ['política da SURI', '/privacidade/'],
])('%s', (_nome, base) => {
  it('mostra versão e data de vigência no formato brasileiro', () => {
    const meta = pagina(base).querySelector('.meta-politica')?.text ?? '';
    expect(meta).toMatch(/Versão 1\.0/);
    expect(meta).toMatch(/vigente desde \d{2}\/\d{2}\/\d{4}/);
  });

  it('enquanto não há revisão jurídica: aviso de minuta e fora dos buscadores', () => {
    const doc = pagina(base);
    expect(doc.querySelector('.aviso-minuta')).not.toBeNull();
    expect(doc.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
  });

  it('o histórico aponta para a página própria de cada versão', () => {
    const links = pagina(base).querySelectorAll('.historico a').map((a) => a.getAttribute('href'));
    expect(links).toContain(`${base}v1.0/`);
    const versao = pagina(`${base}v1.0/`);
    expect(versao.querySelector('.meta-politica')?.text).toMatch(/Versão 1\.0/);
    // v1.0 é a vigente: não pode avisar "versão não está mais em vigor"
    expect(versao.querySelector('.aviso-antiga')).toBeNull();
  });

  it('traz o bloco do encarregado', () => {
    expect(pagina(base).querySelector('[data-encarregado]')).not.toBeNull();
  });
});

describe('anexo de cartórios (só na política do app)', () => {
  it('lista o RISMA', () => {
    const anexo = pagina(app).querySelector('.anexo');
    expect(anexo?.querySelector('h2')?.text).toBe('Anexo — Cartórios atendidos');
    expect(anexo?.text).toMatch(/Registro de Imóveis de Santa Maria/);
  });

  it('não aparece na política da SURI', () => {
    expect(pagina('/privacidade/').querySelector('.anexo')).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL com `página não gerada: /apps/acompanhe/privacidade/`.

- [ ] **Step 3: Coleções e consulta**

`src/content.config.ts`:
```ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const politicas = defineCollection({
  loader: glob({ base: './src/content/politicas', pattern: '*.md' }),
  schema: z.object({
    documento: z.enum(['app', 'suri']),
    versao: z.string().regex(/^\d+\.\d+$/, 'versão no formato MAIOR.MENOR, ex.: 1.0'),
    vigente_desde: z.coerce.date(),
    resumo_das_mudancas: z.string().min(1),
    revisao_juridica: z.boolean(),
  }),
});

const cartorios = defineCollection({
  loader: glob({ base: './src/content/cartorios', pattern: '*.md' }),
  schema: z.object({
    nome: z.string().min(1),
    cidade: z.string().min(1),
    uf: z.string().length(2),
    site: z.string().url(),
    atendido_desde: z.coerce.date(),
  }),
});

export const collections = { politicas, cartorios };
```

`src/lib/politicas.ts`:
```ts
import { getCollection, type CollectionEntry } from 'astro:content';
import { ordenarMaisNovaPrimeiro, verificarVersoesUnicas } from './versao';

export type Politica = CollectionEntry<'politicas'>;

export async function versoes(documento: 'app' | 'suri'): Promise<Politica[]> {
  const lista = await getCollection('politicas', (e) => e.data.documento === documento);
  if (lista.length === 0) throw new Error(`nenhuma versão da política "${documento}" em src/content/politicas`);
  verificarVersoesUnicas(lista);
  return ordenarMaisNovaPrimeiro(lista);
}
```

- [ ] **Step 4: Componentes**

`src/components/Encarregado.astro`:
```astro
---
import { SITE } from '../site.config';
const e = SITE.encarregado;
---
<section data-encarregado aria-labelledby="encarregado-titulo">
  <h2 id="encarregado-titulo">Encarregado pelo tratamento de dados (DPO)</h2>
  {e ? (
    <p>{e.nome} — <a href={`mailto:${e.email}`}>{e.email}</a></p>
  ) : (
    <p>Encarregado em designação. O contato será publicado antes da versão definitiva desta página.</p>
  )}
</section>
```

`src/components/Contato.astro`:
```astro
---
import { SITE } from '../site.config';
const { email, whatsapp } = SITE.contato;
---
<ul data-contato>
  {email && <li>E-mail: <a href={`mailto:${email}`}>{email}</a></li>}
  {whatsapp && <li>WhatsApp: <a href={`https://wa.me/${whatsapp}`}>+{whatsapp}</a></li>}
  {!email && !whatsapp && <li>Canal de contato em definição.</li>}
</ul>
```

`src/components/Politica.astro`:
```astro
---
import { render, type CollectionEntry } from 'astro:content';
import Encarregado from './Encarregado.astro';
import { formatarData } from '../lib/versao';

interface Props {
  entrada: CollectionEntry<'politicas'>;
  vigente: boolean;
  historico: CollectionEntry<'politicas'>[];
  base: string;
}

const { entrada, vigente, historico, base } = Astro.props;
const { Content } = await render(entrada);
const d = entrada.data;
---
<article class="politica">
  {!d.revisao_juridica && (
    <p class="aviso aviso-minuta" role="note">
      <strong>Minuta em revisão jurídica.</strong> Este texto ainda não é a versão definitiva.
    </p>
  )}
  {!vigente && (
    <p class="aviso aviso-antiga" role="note">
      Esta versão não está mais em vigor. <a href={base}>Ver a versão vigente</a>.
    </p>
  )}
  <p class="meta-politica">Versão {d.versao} · vigente desde {formatarData(d.vigente_desde)}</p>
  <Content />
  <slot />
  <Encarregado />
  <section class="historico" aria-labelledby="historico-titulo">
    <h2 id="historico-titulo">Histórico de versões</h2>
    <ul>
      {historico.map((h) => (
        <li>
          <a href={`${base}v${h.data.versao}/`}>Versão {h.data.versao}</a>
          — vigente desde {formatarData(h.data.vigente_desde)}: {h.data.resumo_das_mudancas}
        </li>
      ))}
    </ul>
  </section>
</article>
```

`src/components/AnexoCartorios.astro`:
```astro
---
import { getCollection, render } from 'astro:content';
import { formatarData } from '../lib/versao';

const cartorios = (await getCollection('cartorios')).sort((a, b) => a.data.nome.localeCompare(b.data.nome, 'pt-BR'));
if (cartorios.length === 0) throw new Error('o anexo precisa de pelo menos um cartório em src/content/cartorios');
const itens = await Promise.all(cartorios.map(async (c) => ({ c, Content: (await render(c)).Content })));
---
<section class="anexo" aria-labelledby="anexo-titulo">
  <h2 id="anexo-titulo">Anexo — Cartórios atendidos</h2>
  <p>
    Para os dados do registro (situação, histórico, exigência e certidão de cada pedido), o controlador
    é o cartório responsável pelo pedido. A SURI apenas consulta esses dados em nome dele.
  </p>
  {itens.map(({ c, Content }) => (
    <article class="cartorio">
      <h3>{c.data.nome}</h3>
      <p>
        {c.data.cidade}/{c.data.uf} · <a href={c.data.site}>{c.data.site}</a> ·
        atendido pelo app desde {formatarData(c.data.atendido_desde)}
      </p>
      <Content />
    </article>
  ))}
</section>
```

- [ ] **Step 5: Páginas**

`src/pages/apps/[app]/privacidade/index.astro`:
```astro
---
import Base from '../../../../layouts/Base.astro';
import Politica from '../../../../components/Politica.astro';
import AnexoCartorios from '../../../../components/AnexoCartorios.astro';
import { APP } from '../../../../site.config';
import { versoes } from '../../../../lib/politicas';
import { escolherVigente } from '../../../../lib/versao';

export function getStaticPaths() {
  return [{ params: { app: APP.slug } }];
}

const lista = await versoes('app');
const vigente = escolherVigente(lista, new Date());
---
<Base
  titulo={`Política de privacidade do app ${APP.nome}`}
  descricao={`Como o app ${APP.nome} trata dados pessoais: o que coleta, o que não coleta, por quanto tempo guarda e como exercer seus direitos.`}
  indexar={vigente.data.revisao_juridica}
>
  <h1>Política de privacidade do app {APP.nome}</h1>
  <Politica entrada={vigente} vigente={true} historico={lista} base={`/apps/${APP.slug}/privacidade/`}>
    <AnexoCartorios />
  </Politica>
</Base>
```

`src/pages/apps/[app]/privacidade/[versao].astro`:
```astro
---
import Base from '../../../../layouts/Base.astro';
import Politica from '../../../../components/Politica.astro';
import AnexoCartorios from '../../../../components/AnexoCartorios.astro';
import { APP } from '../../../../site.config';
import { versoes, type Politica as Entrada } from '../../../../lib/politicas';
import { escolherVigente } from '../../../../lib/versao';

export async function getStaticPaths() {
  const lista = await versoes('app');
  return lista.map((entrada) => ({
    params: { app: APP.slug, versao: `v${entrada.data.versao}` },
    props: { entrada },
  }));
}

const { entrada } = Astro.props as { entrada: Entrada };
const lista = await versoes('app');
const vigente = escolherVigente(lista, new Date());
---
<Base
  titulo={`Política de privacidade do app ${APP.nome} — versão ${entrada.data.versao}`}
  descricao={`Versão ${entrada.data.versao} da política de privacidade do app ${APP.nome}.`}
  indexar={false}
>
  <h1>Política de privacidade do app {APP.nome} — versão {entrada.data.versao}</h1>
  <Politica entrada={entrada} vigente={entrada.id === vigente.id} historico={lista} base={`/apps/${APP.slug}/privacidade/`}>
    <AnexoCartorios />
  </Politica>
</Base>
```

`src/pages/privacidade/index.astro`:
```astro
---
import Base from '../../layouts/Base.astro';
import Politica from '../../components/Politica.astro';
import { versoes } from '../../lib/politicas';
import { escolherVigente } from '../../lib/versao';

const lista = await versoes('suri');
const vigente = escolherVigente(lista, new Date());
---
<Base
  titulo="Política de privacidade"
  descricao="Como a SURI Tecnologia trata dados pessoais neste site e nos canais de contato."
  indexar={vigente.data.revisao_juridica}
>
  <h1>Política de privacidade da SURI Tecnologia</h1>
  <Politica entrada={vigente} vigente={true} historico={lista} base="/privacidade/" />
</Base>
```

`src/pages/privacidade/[versao].astro`:
```astro
---
import Base from '../../layouts/Base.astro';
import Politica from '../../components/Politica.astro';
import { versoes, type Politica as Entrada } from '../../lib/politicas';
import { escolherVigente } from '../../lib/versao';

export async function getStaticPaths() {
  const lista = await versoes('suri');
  return lista.map((entrada) => ({ params: { versao: `v${entrada.data.versao}` }, props: { entrada } }));
}

const { entrada } = Astro.props as { entrada: Entrada };
const lista = await versoes('suri');
const vigente = escolherVigente(lista, new Date());
---
<Base
  titulo={`Política de privacidade — versão ${entrada.data.versao}`}
  descricao={`Versão ${entrada.data.versao} da política de privacidade da SURI Tecnologia.`}
  indexar={false}
>
  <h1>Política de privacidade da SURI Tecnologia — versão {entrada.data.versao}</h1>
  <Politica entrada={entrada} vigente={entrada.id === vigente.id} historico={lista} base="/privacidade/" />
</Base>
```

- [ ] **Step 6: Textos das políticas e do anexo**

`src/content/cartorios/risma.md`:
```markdown
---
nome: Registro de Imóveis de Santa Maria - RS
cidade: Santa Maria
uf: RS
site: https://www.risantamaria.com.br
atendido_desde: 2026-10-14
---

Dados consultados pelo app neste cartório: situação atual e histórico de situações do pedido,
texto da exigência (quando o título for impugnado) e link da certidão assinada. O app **não** consulta
partes do processo, endereço, CPF, nome nem contato dos apresentantes.
```

`src/content/politicas/app-v1-0.md`:
```markdown
---
documento: app
versao: "1.0"
vigente_desde: 2026-10-14
resumo_das_mudancas: Primeira versão.
revisao_juridica: false
---

## 1. Quem somos e quem decide sobre cada dado

O app é desenvolvido, publicado e mantido pela **SURI Tecnologia**. Há dois tipos de dado, com
responsáveis diferentes:

- **Dados do app** (os que permitem que ele funcione no seu aparelho): a SURI é a **controladora**.
- **Dados do registro** (a situação do seu pedido no cartório): o **cartório** é o controlador. A SURI
  só consulta esses dados em nome dele, como **operadora**, para mostrá-los a você. Os cartórios
  atendidos estão no anexo ao final desta página.

## 2. O app não tem cadastro

Para acompanhar um pedido, você usa a **chave de acesso** e o **validador** impressos na nota de
entrega do cartório (ou lê o QR Code da nota). Não pedimos nem guardamos nome, CPF, telefone ou
e-mail.

## 3. Dados que tratamos

| Dado | Onde fica | Para quê |
|---|---|---|
| Chave de acesso e validador | só no seu aparelho, no armazenamento seguro do sistema (Keychain no iOS, Keystore no Android) | consultar o pedido |
| Código interno do pedido e um resumo criptográfico (HMAC) da chave e do validador | servidor da SURI | ligar o aparelho ao pedido sem guardar a chave em texto |
| Token de notificação do aparelho | servidor da SURI | enviar o aviso de nova etapa |
| Última situação notificada de cada pedido | servidor da SURI | não repetir avisos |
| Registros de acesso (endereço IP, data e hora, rota acessada) e de tentativas de consulta | servidor da SURI | segurança, prevenção de fraude e cumprimento do Marco Civil da Internet |

Na **consulta pelo navegador**, a chave e o validador ficam no próprio link, depois do `#`, parte que
o navegador não envia ao servidor. A página os envia à consulta e não os guarda depois de fechada.

## 4. Para que usamos e com que base legal

- **Mostrar a situação do pedido e avisar a cada nova etapa:** é o serviço que você mesmo pede ao
  adicionar o pedido no app (LGPD, art. 7º, V).
- **Registros de acesso e de tentativas:** segurança do serviço e prevenção de fraude, por legítimo
  interesse (LGPD, art. 7º, IX), e guarda obrigatória dos registros de acesso a aplicações
  (Marco Civil da Internet, Lei 12.965/2014, art. 15).
- **Dados do registro:** o cartório os trata no exercício de sua função pública delegada
  (LGPD, arts. 7º, III, e 23).

## 5. Avisos (notificações)

O texto do aviso é sempre genérico, por exemplo: "Seu pedido nº 829894 avançou de etapa". Ele passa
pelos serviços de notificação do Google (Firebase Cloud Messaging) e da Apple (APNs), que podem
processá-lo fora do Brasil. Por isso, o conteúdo da exigência e o link da certidão só aparecem
**dentro do app**, nunca no aviso.

## 6. Com quem compartilhamos

- **Google e Apple:** só o token do aparelho e o texto genérico do aviso, para entregar a notificação.
- **Cloudflare:** proteção e entrega das páginas e da consulta pela web. Processa o endereço IP e,
  na consulta pelo navegador, aplica uma verificação anti-robô (Turnstile).
- **Cartório responsável pelo pedido:** a consulta é feita no sistema dele, só para leitura.

Não vendemos dados e não usamos dados para publicidade.

## 7. Por quanto tempo guardamos

- **Vínculo entre o aparelho e o pedido:** apagado quando você remove o pedido no app ou, no
  máximo, **90 dias depois da conclusão do pedido**.
- **Registros de acesso:** **6 meses**, prazo do Marco Civil da Internet. Depois disso, são apagados.
- **No aparelho:** a chave, o validador e a lista de pedidos ficam até você removê-los ou desinstalar o app.

## 8. Segurança

Comunicação sempre criptografada (HTTPS), limite de tentativas de consulta com bloqueio temporário,
verificação anti-robô na consulta pela web e acesso **somente de leitura** ao sistema do cartório.
Depois do primeiro acesso, o app troca a chave do pedido por um código aleatório próprio, emitido pelo
servidor.

## 9. Seus direitos

Você pode pedir confirmação de tratamento, acesso, correção, anonimização, eliminação, portabilidade,
informação sobre compartilhamento e revogação de consentimento (LGPD, art. 18). Como o app não sabe
quem você é, a forma mais rápida de apagar seus dados é **remover o pedido no app**. Veja também a
página "Como excluir seus dados" e a página "Seus direitos (LGPD)". Sobre os dados do registro, o
pedido deve ser feito ao cartório responsável.

## 10. Crianças e adolescentes

O app não é direcionado a menores de 18 anos.

## 11. Mudanças nesta política

Cada versão fica publicada com data de vigência e um resumo do que mudou, no histórico ao final desta
página. Mudanças relevantes também serão avisadas dentro do app.
```

`src/content/politicas/suri-v1-0.md`:
```markdown
---
documento: suri
versao: "1.0"
vigente_desde: 2026-10-14
resumo_das_mudancas: Primeira versão.
revisao_juridica: false
---

Esta política vale para o site da SURI Tecnologia e para os nossos canais de contato. A política de
cada app fica na página própria do app.

## 1. O site não coleta dados por conta própria

Este site não tem formulários, não usa cookies, não usa ferramentas de estatística ou publicidade e não
carrega fontes, scripts ou imagens de terceiros.

## 2. Registros de acesso

Como todo site, o servidor registra o endereço IP, a data e a hora, a página acessada e o navegador
usado. Guardamos esses registros por **6 meses**, prazo do Marco Civil da Internet (Lei 12.965/2014,
art. 15), para segurança e prevenção de abusos (LGPD, art. 7º, II e IX). A Cloudflare, que protege e
entrega o site, também processa esses dados.

## 3. Quando você fala com a gente

Se você nos escrever por e-mail ou WhatsApp, usamos o que você enviar só para responder e dar
andamento ao assunto. O WhatsApp é um serviço da Meta, sujeito à política de privacidade dela.
Guardamos a conversa enquanto o assunto estiver em andamento e pelo prazo necessário para cumprir
obrigações legais ou defender direitos.

## 4. Seus direitos

Você pode exercer os direitos do art. 18 da LGPD pelo contato do encarregado, abaixo, ou pela página
"Seus direitos (LGPD)".

## 5. Mudanças nesta política

Cada versão fica publicada com data de vigência e um resumo do que mudou, no histórico ao final desta
página.
```

- [ ] **Step 7: Rodar e ver passar**

Run: `npm test`
Expected: PASS em `politicas.test.ts` (10 casos) e nos testes anteriores.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: políticas de privacidade versionadas do app e da SURI, com anexo por cartório"
```

---

### Task 4: Páginas do app, LGPD e 404

**Files:**
- Create: `src/pages/apps/[app]/index.astro`, `src/pages/apps/[app]/suporte.astro`, `src/pages/apps/[app]/excluir-dados.astro`
- Create: `src/pages/lgpd.astro`, `src/pages/404.astro`
- Test: `tests/paginas.test.ts`

**Interfaces:**
- Consumes: `Base.astro`, `Contato.astro`, `Encarregado.astro`, `APP`, `ROTAS`, `pagina`.
- Produces: as rotas `/apps/<slug>/`, `/apps/<slug>/suporte/`, `/apps/<slug>/excluir-dados/`, `/lgpd/` e o arquivo `dist/404.html`.

- [ ] **Step 1: Escrever o teste que falha**

`tests/paginas.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { APP } from '../src/site.config';
import { DIST, pagina } from './helpers/dist';
import { ROTAS } from './helpers/rotas';

describe('as 7 rotas da spec', () => {
  it.each(ROTAS)('%s existe, com um único h1', (rota) => {
    expect(pagina(rota).querySelectorAll('h1')).toHaveLength(1);
  });

  it('cada rota tem título próprio', () => {
    const titulos = ROTAS.map((r) => pagina(r).querySelector('title')?.text);
    expect(new Set(titulos).size).toBe(ROTAS.length);
  });
});

describe('página do app', () => {
  it('liga para privacidade, suporte e exclusão de dados', () => {
    const hrefs = pagina(`/apps/${APP.slug}/`).querySelectorAll('main a').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining([
      `/apps/${APP.slug}/privacidade/`, `/apps/${APP.slug}/suporte/`, `/apps/${APP.slug}/excluir-dados/`,
    ]));
  });

  it('suporte traz o bloco de contato', () => {
    expect(pagina(`/apps/${APP.slug}/suporte/`).querySelector('[data-contato]')).not.toBeNull();
  });

  it('exclusão de dados explica o prazo de 90 dias e o que não é apagado', () => {
    const texto = pagina(`/apps/${APP.slug}/excluir-dados/`).text;
    expect(texto).toMatch(/90 dias/);
    expect(texto).toMatch(/6 meses/);
  });
});

describe('LGPD e 404', () => {
  it('/lgpd/ cita o art. 18, o prazo de resposta e o encarregado', () => {
    const doc = pagina('/lgpd/');
    expect(doc.text).toMatch(/art\. 18/);
    expect(doc.text).toMatch(/15 dias/);
    expect(doc.querySelector('[data-encarregado]')).not.toBeNull();
  });

  it('gera 404.html fora dos buscadores', () => {
    expect(existsSync(join(DIST, '404.html'))).toBe(true);
    expect(pagina('/404.html').querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL com `página não gerada: /apps/acompanhe/`.

- [ ] **Step 3: Implementar as páginas**

`src/pages/apps/[app]/index.astro`:
```astro
---
import Base from '../../../layouts/Base.astro';
import { APP } from '../../../site.config';

export function getStaticPaths() {
  return [{ params: { app: APP.slug } }];
}

const base = `/apps/${APP.slug}/`;
---
<Base titulo={`App ${APP.nome}`} descricao={`Acompanhe seu pedido no cartório e receba um aviso a cada nova etapa com o app ${APP.nome}, sem cadastro.`}>
  <h1>App {APP.nome}</h1>
  <p>
    Acompanhe a situação do seu pedido de registro ou de certidão e receba um aviso a cada nova etapa.
    Sem cadastro: basta a chave de acesso e o validador da nota de entrega, ou o QR Code impresso nela.
  </p>
  <h2>Como funciona</h2>
  <ol>
    <li>No cartório, você recebe a nota de entrega do pedido.</li>
    <li>No app, leia o QR Code da nota ou digite a chave de acesso e o validador.</li>
    <li>Pronto: o app mostra a situação e o histórico, e avisa quando o pedido mudar de etapa.</li>
  </ol>
  <h2>Disponibilidade</h2>
  <p>O app está em desenvolvimento e em breve estará na App Store e no Google Play.</p>
  <h2>Privacidade e ajuda</h2>
  <ul>
    <li><a href={`${base}privacidade/`}>Política de privacidade do app</a></li>
    <li><a href={`${base}suporte/`}>Suporte</a></li>
    <li><a href={`${base}excluir-dados/`}>Como excluir seus dados</a></li>
  </ul>
</Base>
```

`src/pages/apps/[app]/suporte.astro`:
```astro
---
import Base from '../../../layouts/Base.astro';
import Contato from '../../../components/Contato.astro';
import { APP } from '../../../site.config';

export function getStaticPaths() {
  return [{ params: { app: APP.slug } }];
}
---
<Base titulo={`Suporte do app ${APP.nome}`} descricao={`Ajuda e contato para quem usa o app ${APP.nome}.`}>
  <h1>Suporte do app {APP.nome}</h1>
  <h2>Fale com a SURI</h2>
  <Contato />
  <h2>Dúvidas frequentes</h2>
  <h3>Onde encontro a chave de acesso e o validador?</h3>
  <p>Na nota de entrega que o cartório emite quando recebe o seu pedido, junto com o QR Code.</p>
  <h3>Perdi a nota de entrega. E agora?</h3>
  <p>Peça uma segunda via ao cartório onde o pedido foi feito.</p>
  <h3>O app não encontra o meu pedido.</h3>
  <p>
    Confira se a chave e o validador foram digitados exatamente como na nota. Depois de várias
    tentativas erradas, a consulta fica bloqueada por alguns minutos, por segurança.
  </p>
  <h3>Tenho uma dúvida sobre o andamento do pedido em si.</h3>
  <p>O app mostra o que o cartório registra. Dúvidas sobre exigências, prazos ou valores devem ser tratadas com o cartório.</p>
</Base>
```

`src/pages/apps/[app]/excluir-dados.astro`:
```astro
---
import Base from '../../../layouts/Base.astro';
import Encarregado from '../../../components/Encarregado.astro';
import { APP } from '../../../site.config';

export function getStaticPaths() {
  return [{ params: { app: APP.slug } }];
}
---
<Base titulo={`Como excluir seus dados do app ${APP.nome}`} descricao={`Como apagar seus dados do app ${APP.nome}: no próprio app, automaticamente ou por pedido ao encarregado.`}>
  <h1>Como excluir seus dados do app {APP.nome}</h1>
  <h2>No próprio app (imediato)</h2>
  <p>
    Remova o pedido da sua lista. Na hora, o app apaga a chave e o validador do aparelho, e o servidor
    apaga o vínculo entre o seu aparelho e aquele pedido. Desinstalar o app apaga tudo o que estava no aparelho.
  </p>
  <h2>Automaticamente</h2>
  <p>O vínculo entre o aparelho e o pedido é apagado, no máximo, 90 dias depois da conclusão do pedido.</p>
  <h2>Por pedido</h2>
  <p>Se preferir, peça a exclusão ao nosso encarregado, informando o número do pedido.</p>
  <Encarregado />
  <h2>O que não é apagado</h2>
  <ul>
    <li>Os registros de acesso, guardados por 6 meses por exigência do Marco Civil da Internet.</li>
    <li>Os dados do registro no cartório, que pertencem ao cartório e seguem as regras próprias da atividade registral.</li>
  </ul>
</Base>
```

`src/pages/lgpd.astro`:
```astro
---
import Base from '../layouts/Base.astro';
import Encarregado from '../components/Encarregado.astro';
---
<Base titulo="Seus direitos (LGPD)" descricao="Como exercer, junto à SURI Tecnologia, os seus direitos de titular de dados pessoais previstos na LGPD.">
  <h1>Seus direitos como titular de dados (LGPD)</h1>
  <p>Pela Lei Geral de Proteção de Dados (Lei 13.709/2018, art. 18), você pode pedir à SURI:</p>
  <ul>
    <li>confirmação de que tratamos dados seus;</li>
    <li>acesso aos dados;</li>
    <li>correção de dados incompletos, inexatos ou desatualizados;</li>
    <li>anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos;</li>
    <li>portabilidade dos dados;</li>
    <li>eliminação dos dados tratados com base no seu consentimento;</li>
    <li>informação sobre com quem compartilhamos seus dados;</li>
    <li>informação sobre a possibilidade de não dar consentimento e as consequências disso;</li>
    <li>revogação do consentimento.</li>
  </ul>
  <h2>Como pedir</h2>
  <p>
    Escreva ao encarregado, abaixo. Respondemos à confirmação de existência ou ao acesso aos dados de
    forma simplificada imediatamente, ou com declaração completa em até 15 dias (LGPD, art. 19).
  </p>
  <p>
    Pedidos sobre os dados do registro de um pedido em cartório devem ser feitos ao próprio cartório,
    que é o controlador desses dados.
  </p>
  <Encarregado />
  <h2>Se não ficar satisfeito</h2>
  <p>Você pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</p>
</Base>
```

`src/pages/404.astro`:
```astro
---
import Base from '../layouts/Base.astro';
---
<Base titulo="Página não encontrada" descricao="A página procurada não existe." indexar={false}>
  <h1>Página não encontrada</h1>
  <p>O endereço pode ter mudado. <a href="/">Voltar para o início</a>.</p>
</Base>
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS em `paginas.test.ts` (12 casos) e nos anteriores.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: páginas do app (vitrine, suporte, exclusão de dados), LGPD e 404"
```

---

### Task 5: Verificações sobre todas as páginas (CSP, fontes, links)

**Files:**
- Test: `tests/transversal.test.ts`

**Interfaces:**
- Consumes: `arquivos`, `rotaDoArquivo`, `arquivoDaRota`, `DIST`.
- Produces: nada novo. É uma rede de segurança para as próximas mudanças.

- [ ] **Step 1: Escrever os testes**

`tests/transversal.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'node-html-parser';
import { DIST, arquivoDaRota, arquivos, rotaDoArquivo } from './helpers/dist';

const html = arquivos('.html');
const css = arquivos('.css');

it('o build gerou o conjunto esperado de páginas (protege contra teste vazio)', () => {
  // 7 rotas + 2 páginas de versão + 404
  expect(html.length).toBeGreaterThanOrEqual(10);
  expect(css.length).toBeGreaterThanOrEqual(1);
});

describe.each(html.map((f) => [rotaDoArquivo(f), f]))('%s', (_rota, arquivo) => {
  const doc = parse(readFileSync(arquivo, 'utf8'));

  it('sem script, sem <style> e sem style= (CSP sem unsafe-inline)', () => {
    expect(doc.querySelectorAll('script')).toHaveLength(0);
    expect(doc.querySelectorAll('style')).toHaveLength(0);
    expect(doc.querySelectorAll('[style]')).toHaveLength(0);
  });

  it('nenhum recurso carregado de outro domínio', () => {
    const recursos = [
      ...doc.querySelectorAll('link[href]').map((e) => e.getAttribute('href')!),
      ...doc.querySelectorAll('img[src], source[src], audio[src], video[src]').map((e) => e.getAttribute('src')!),
    ];
    expect(recursos.filter((u) => /^(https?:)?\/\//.test(u))).toEqual([]);
    expect(doc.querySelectorAll('iframe, object, embed')).toHaveLength(0);
  });

  it('todo link interno aponta para um arquivo que existe no build', () => {
    const quebrados = doc.querySelectorAll('a[href^="/"], link[href^="/"]')
      .map((a) => a.getAttribute('href')!)
      .filter((href) => {
        const alvo = arquivoDaRota(href);
        return !(existsSync(alvo) && statSync(alvo).isFile());
      });
    expect(quebrados).toEqual([]);
  });
});

describe('CSS', () => {
  it.each(css)('%s não importa nada de fora', (arquivo) => {
    const conteudo = readFileSync(arquivo, 'utf8');
    expect(conteudo).not.toMatch(/url\(\s*['"]?(https?:)?\/\//);
    expect(conteudo).not.toMatch(/@import/);
  });

  it('declara as duas famílias da marca com arquivos locais', () => {
    const tudo = css.map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(tudo).toMatch(/font-family:\s*['"]?Sora/);
    expect(tudo).toMatch(/font-family:\s*['"]?IBM Plex Sans/);
    for (const [, url] of tudo.matchAll(/url\(([^)]+\.woff2)\)/g)) {
      expect(existsSync(join(DIST, url.replace(/^['"]?\//, '').replace(/['"]$/, '')))).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Rodar**

Run: `npm test`
Expected: PASS. Se algum caso falhar, corrija a página ou a configuração, nunca o teste. Uma falha provável é o Astro ter emitido algum `<style>` ou `<script>` inline: confira `inlineStylesheets: 'never'` em `astro.config.mjs`.

- [ ] **Step 3: Provar que os testes pegam o problema (checagem do instrumento)**

Acrescente temporariamente `<script>console.log(1)</script>` dentro do `<body>` de `src/pages/index.astro`.
Run: `npm test`
Expected: FAIL em `/ > sem script, sem <style> e sem style=`.
Remova a linha, rode `npm test` de novo e confirme PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/transversal.test.ts
git commit -m "test: verificações de CSP, recursos externos, fontes locais e links internos em todas as páginas"
```

---

### Task 6: Container, repositório público e CI do site

**Files:**
- Create: `nginx/default.conf`, `Dockerfile`, `.dockerignore`, `scripts/smoke-container.sh`
- Create: `.github/workflows/ci.yml`, `.github/dependabot.yml`, `README.md`

**Interfaces:**
- Consumes: `src/config/site.json` (`.app.slug`, lido com `jq`), `npm test`, `npm run test:release`.
- Produces: imagem `ghcr.io/suri-tecnologia/site-suri` com os tags `main` e `sha-<7>` (a cada push na `main`) e `<versão>` (a cada tag `v<versão>`); container escutando em `8080` com `GET /healthz` → `200 ok`.

- [ ] **Step 1: Configuração do nginx e Dockerfile**

`nginx/default.conf`:
```nginx
server {
    listen 8080;
    server_name _;
    root /usr/share/nginx/html;

    server_tokens off;
    # Redirecionamentos relativos: nunca expor a porta interna 8080
    absolute_redirect off;

    location = /healthz {
        access_log off;
        default_type text/plain;
        return 200 "ok\n";
    }

    location /_astro/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        try_files $uri $uri/ =404;
    }

    error_page 404 /404.html;
}
```

`Dockerfile`:
```dockerfile
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.31.6-alpine@sha256:884e0b7f42f303641b0f4e78755aea647521dca0b89ca3be7992ad78b5c07434
LABEL org.opencontainers.image.source="https://github.com/suri-tecnologia/site-suri"
LABEL org.opencontainers.image.description="Site da SURI Tecnologia (HTML estático)"
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
```

`.dockerignore`:
```
node_modules
dist
.astro
.git
docs
```

- [ ] **Step 2: Smoke test do container**

`scripts/smoke-container.sh`:
```bash
#!/usr/bin/env bash
# Sobe a imagem do site com as mesmas restrições de produção e confere rotas e redirecionamento.
# Uso: scripts/smoke-container.sh <imagem> <slug-do-app>
set -euo pipefail
IMAGEM="${1:?uso: smoke-container.sh <imagem> <slug-do-app>}"
SLUG="${2:?uso: smoke-container.sh <imagem> <slug-do-app>}"
NOME="smoke-site-suri-$$"
BASE="http://127.0.0.1:18080"

docker run -d --name "$NOME" --read-only --cap-drop ALL --security-opt no-new-privileges:true \
  --tmpfs /tmp --tmpfs /var/cache/nginx -p 127.0.0.1:18080:8080 "$IMAGEM" >/dev/null
trap 'docker logs "$NOME" >&2 || true; docker rm -f "$NOME" >/dev/null' EXIT

for _ in $(seq 1 30); do curl -fs "$BASE/healthz" >/dev/null && break; sleep 1; done

falhas=0
confere() { # <rota> <código esperado>
  local codigo
  codigo=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$1")
  if [ "$codigo" = "$2" ]; then echo "ok    $1 → $codigo"; else echo "FALHA $1 → $codigo (esperado $2)"; falhas=$((falhas + 1)); fi
}

confere / 200
confere "/apps/$SLUG/" 200
confere "/apps/$SLUG/privacidade/" 200
confere "/apps/$SLUG/privacidade/v1.0/" 200
confere "/apps/$SLUG/suporte/" 200
confere "/apps/$SLUG/excluir-dados/" 200
confere /privacidade/ 200
confere /lgpd/ 200
confere /favicon.svg 200
confere /nao-existe 404
confere "/apps/$SLUG/privacidade" 301

destino=$(curl -s -o /dev/null -w '%{redirect_url}' "$BASE/apps/$SLUG/privacidade")
if [ "$destino" = "$BASE/apps/$SLUG/privacidade/" ]; then
  echo "ok    redirecionamento mantém host e porta → $destino"
else
  echo "FALHA redirecionamento foi para $destino (vazou porta ou host interno?)"; falhas=$((falhas + 1))
fi

[ "$falhas" -eq 0 ] || { echo "$falhas falha(s)"; exit 1; }
echo "smoke do container: ok"
```

- [ ] **Step 3: Workflow do CI e Dependabot**

`.github/workflows/ci.yml`:
```yaml
name: ci

on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:

permissions:
  contents: read
  packages: write

jobs:
  testes:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - name: checagem de publicação (pendências)
        if: startsWith(github.ref, 'refs/tags/v')
        run: npm run test:release

  imagem:
    needs: testes
    runs-on: ubuntu-24.04
    env:
      IMAGEM: ghcr.io/suri-tecnologia/site-suri
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - name: build
        run: docker build -t site-suri:ci .
      - name: smoke do container
        run: scripts/smoke-container.sh site-suri:ci "$(jq -r .app.slug src/config/site.json)"
      - name: varredura Trivy (alta/crítica bloqueia)
        run: >
          docker run --rm -v /var/run/docker.sock:/var/run/docker.sock
          aquasec/trivy:0.75.0@sha256:af6acf9a6b85dfe389a1941505c0ce9efef52a4719635e1a962f022a3d855daa
          image --exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed site-suri:ci
      - name: login no GHCR
        if: github.event_name == 'push'
        run: echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u "${{ github.actor }}" --password-stdin
      - name: publicar main e sha
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        run: |
          for t in main "sha-${GITHUB_SHA::7}"; do
            docker tag site-suri:ci "$IMAGEM:$t"
            docker push "$IMAGEM:$t"
          done
      - name: publicar versão
        if: startsWith(github.ref, 'refs/tags/v')
        run: |
          v="${GITHUB_REF_NAME#v}"
          docker tag site-suri:ci "$IMAGEM:$v"
          docker push "$IMAGEM:$v"
```

`.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule: { interval: weekly }
  - package-ecosystem: docker
    directory: /
    schedule: { interval: weekly }
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: weekly }
```

`README.md`:
```markdown
# site-suri

Site da SURI Tecnologia (`https://suritecnologia.com`), em Astro, publicado como HTML estático numa imagem nginx sem root.

- Desenvolver: `npm install` e `npm run dev`
- Testar: `npm test` (faz o build e testa o `dist/`)
- Conferir se dá para publicar: `npm run test:release` (falha enquanto houver pendências em `src/config/site.json`)
- Publicar: tag `vX.Y.Z` → o CI publica `ghcr.io/suri-tecnologia/site-suri:X.Y.Z`; depois, atualizar o tag em `suri-infra/stacks/sites/compose.yaml`.
- Políticas: `src/content/politicas/`. Nova versão = arquivo novo (`app-v1-1.md`), nunca editar uma versão publicada.
```

- [ ] **Step 4: Commit local**

```bash
git add -A
git update-index --chmod=+x scripts/smoke-container.sh
git commit -m "build: imagem nginx sem root, smoke test do container e CI com Trivy e GHCR"
```

- [ ] **Step 5: Criar o repositório público e enviar** *(ação externa: confirmar com o usuário antes de rodar)*

```bash
GH="/c/Program Files/GitHub CLI/gh.exe"
"$GH" repo create suri-tecnologia/site-suri --public --description "Site da SURI Tecnologia" --source . --remote origin --push
```
Expected: repositório criado e `main` enviada.

- [ ] **Step 6: Acompanhar o CI**

Run: `"$GH" run watch --repo suri-tecnologia/site-suri --exit-status`
Expected: jobs `testes` e `imagem` verdes. O log do smoke termina com `smoke do container: ok`, e o Trivy sai com código 0. Se o Trivy acusar CVE alta ou crítica com correção disponível, atualize o digest da imagem base afetada (Global Constraints) e reenvie.

- [ ] **Step 7: Tornar o pacote público e proteger a branch** *(o primeiro passo é ação do usuário)*

Usuário: em `github.com/orgs/suri-tecnologia/packages/container/site-suri/settings` → *Change visibility* → **Public**.

Depois, proteção da `main` contra force-push e exclusão:
```bash
"$GH" api -X PUT repos/suri-tecnologia/site-suri/branches/main/protection --input - <<'EOF'
{
  "required_status_checks": null,
  "enforce_admins": true,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```
Verificação: `"$GH" api repos/suri-tecnologia/site-suri/branches/main/protection --jq .allow_force_pushes.enabled` → `false`. O acesso anônimo à imagem é provado na Task 7, quando o CI do `suri-infra` baixa `site-suri:main` sem login.

---

### Task 7: suri-infra — proxy Caddy, stacks e smoke test do zero

**Files (pasta nova `C:\projetos_claude\suri-infra`):**
- Create: `proxy/Caddyfile`, `proxy/Dockerfile`, `proxy/compose.yaml`
- Create: `stacks/sites/compose.yaml`, `stacks/app-risma/README.md`
- Create: `tests/smoke.sh`, `tests/compose.proxy.ci.yaml`, `tests/compose.sites.ci.yaml`
- Create: `.github/workflows/ci.yml`, `.github/dependabot.yml`, `.gitattributes`, `README.md`

**Interfaces:**
- Consumes: imagem pública `ghcr.io/suri-tecnologia/site-suri:main` (Task 6), que escuta em `8080` e responde em `/healthz`.
- Produces: rede Docker `suri-net` (criada pela stack `suri-proxy`); serviço `site-suri` resolvível nessa rede; Caddy publicado em `${SURI_BIND}:8088`; variáveis `SURI_BIND` e `SURI_PROXY_CONFIAVEL`; imagem `ghcr.io/suri-tecnologia/suri-proxy:<versão>` (tag git `proxy-v<versão>`).

- [ ] **Step 1: Criar a pasta e o git**

```bash
mkdir -p /c/projetos_claude/suri-infra && cd /c/projetos_claude/suri-infra
git init -b main
git config user.name "Rodrigo" && git config user.email "rodrigodacunhalopes@gmail.com"
mkdir -p proxy stacks/sites stacks/app-risma tests backup docs .github/workflows
```

`.gitattributes`:
```
* text=auto eol=lf
```

- [ ] **Step 2: Escrever o smoke test (que falha enquanto não houver proxy)**

`tests/compose.proxy.ci.yaml`:
```yaml
services:
  caddy:
    image: ${PROXY_IMAGE}
```

`tests/compose.sites.ci.yaml`:
```yaml
services:
  site-suri:
    image: ghcr.io/suri-tecnologia/site-suri:main
```

`tests/smoke.sh`:
```bash
#!/usr/bin/env bash
# Sobe proxy + site do zero, com os mesmos comandos do runbook, e confere rotas, cabeçalhos e o bloqueio por origem.
# Uso: PROXY_IMAGE=<imagem do proxy> tests/smoke.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${PROXY_IMAGE:?defina PROXY_IMAGE com a imagem do proxy a testar}"
export PROXY_IMAGE
export SURI_BIND=127.0.0.1
# Do host, o Caddy vê o gateway da rede Docker (faixa 172.16.0.0/12) como origem
export SURI_PROXY_CONFIAVEL="172.16.0.0/12"
BASE="http://127.0.0.1:8088"
PROXY=(docker compose -f proxy/compose.yaml -f tests/compose.proxy.ci.yaml)
SITES=(docker compose -f stacks/sites/compose.yaml -f tests/compose.sites.ci.yaml)

derrubar() { "${SITES[@]}" down -v >/dev/null 2>&1 || true; "${PROXY[@]}" down -v >/dev/null 2>&1 || true; }
trap derrubar EXIT

"${PROXY[@]}" up -d
"${SITES[@]}" up -d

pronto=0
for _ in $(seq 1 60); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: suritecnologia.com' "$BASE/")" = "200" ] && { pronto=1; break; }
  sleep 1
done
[ "$pronto" -eq 1 ] || { echo "FALHA: site não respondeu 200 em 60 s"; "${PROXY[@]}" logs; "${SITES[@]}" logs; exit 1; }

falhas=0
ok() { echo "ok    $1"; }
falha() { echo "FALHA $1"; falhas=$((falhas + 1)); }
codigo() { curl -s -o /dev/null -w '%{http_code}' -H "Host: $1" "$BASE$2"; }

if [ "$(codigo suritecnologia.com /privacidade/)" = "200" ]; then ok "/privacidade/ 200"; else falha "/privacidade/"; fi
if [ "$(codigo suritecnologia.com /nao-existe)" = "404" ]; then ok "/nao-existe 404"; else falha "/nao-existe"; fi
if [ "$(codigo exemplo.invalid /)" = "404" ]; then ok "host desconhecido 404"; else falha "host desconhecido"; fi

cab=$(curl -sI -H 'Host: suritecnologia.com' "$BASE/" | tr -d '\r')
for esperado in \
  "content-security-policy: default-src 'self'" \
  "strict-transport-security: max-age=31536000" \
  "x-content-type-options: nosniff" \
  "referrer-policy: strict-origin-when-cross-origin" \
  "permissions-policy: camera=()" \
  "x-frame-options: DENY"; do
  if grep -qiF "$esperado" <<<"$cab"; then ok "cabeçalho $esperado"; else falha "cabeçalho ausente: $esperado"; fi
done
if grep -qi '^server:' <<<"$cab"; then falha "cabeçalho Server exposto"; else ok "sem cabeçalho Server"; fi

loc=$(curl -sI -H 'Host: www.suritecnologia.com' "$BASE/privacidade/" | tr -d '\r' | awk 'tolower($1)=="location:"{print $2}')
if [ "$loc" = "https://suritecnologia.com/privacidade/" ]; then ok "www → $loc"; else falha "www redirecionou para '$loc'"; fi

# Origem fora do proxy de borda deve receber 403
SURI_PROXY_CONFIAVEL="192.0.2.1/32" "${PROXY[@]}" up -d --force-recreate
for _ in $(seq 1 30); do curl -fs "$BASE/healthz" >/dev/null && break; sleep 1; done
if [ "$(codigo suritecnologia.com /)" = "403" ]; then ok "origem não confiável → 403"; else falha "origem não confiável não foi bloqueada"; fi

[ "$falhas" -eq 0 ] || { echo "$falhas falha(s)"; exit 1; }
echo "smoke da infra: ok"
```

- [ ] **Step 3: Escrever o proxy e as stacks**

`proxy/Caddyfile`:
```caddyfile
# Porta de entrada da SURI. O TLS fica na borda (Cloudflare/OPNsense); aqui só HTTP interno na 8080.
{
	admin off
	auto_https off
	http_port 8080
	servers {
		trusted_proxies static {$SURI_PROXY_CONFIAVEL}
	}
}

(seguranca) {
	@fora_do_proxy not remote_ip {$SURI_PROXY_CONFIAVEL}
	respond @fora_do_proxy "Acesso permitido somente pelo proxy de borda." 403
	header {
		defer
		Strict-Transport-Security "max-age=31536000"
		Content-Security-Policy "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
		Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
		X-Frame-Options "DENY"
		-Server
	}
}

http://suritecnologia.com {
	import seguranca
	reverse_proxy site-suri:8080 {
		header_down -Server
	}
}

http://www.suritecnologia.com {
	import seguranca
	redir https://suritecnologia.com{uri} permanent
}

http:// {
	handle /healthz {
		respond "ok" 200
	}
	handle {
		respond 404
	}
}
```

`proxy/Dockerfile`:
```dockerfile
FROM caddy:2.11.7-alpine@sha256:d8542f48d34a9cf4e4c11a478865229840e87e4c96ea3f439101f31a5d35f75f
LABEL org.opencontainers.image.source="https://github.com/suri-tecnologia/suri-infra"
LABEL org.opencontainers.image.description="Proxy interno da SURI (Caddy + cabeçalhos de segurança)"
COPY Caddyfile /etc/caddy/Caddyfile
RUN SURI_PROXY_CONFIAVEL=127.0.0.1/32 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
```

`proxy/compose.yaml`:
```yaml
name: suri-proxy

services:
  caddy:
    image: ghcr.io/suri-tecnologia/suri-proxy:1.0.0
    restart: unless-stopped
    ports:
      - "${SURI_BIND:-127.0.0.1}:8088:8080"
    environment:
      SURI_PROXY_CONFIAVEL: ${SURI_PROXY_CONFIAVEL:-127.0.0.1/32}
    volumes:
      - caddy_data:/data
      - caddy_config:/config
    networks: [suri-net]
    read_only: true
    cap_drop: [ALL]
    security_opt: ["no-new-privileges:true"]
    tmpfs: [/tmp]
    deploy:
      resources:
        limits: { cpus: "0.50", memory: 128M }

networks:
  suri-net:
    name: suri-net

volumes:
  caddy_data:
  caddy_config:
```

`stacks/sites/compose.yaml`:
```yaml
name: suri-sites

services:
  site-suri:
    image: ghcr.io/suri-tecnologia/site-suri:1.0.0
    restart: unless-stopped
    networks: [suri-net]
    read_only: true
    cap_drop: [ALL]
    security_opt: ["no-new-privileges:true"]
    tmpfs:
      - /tmp
      - /var/cache/nginx
    deploy:
      resources:
        limits: { cpus: "0.50", memory: 64M }

networks:
  suri-net:
    external: true
```

`stacks/app-risma/README.md`:
```markdown
# app-risma (reservado)

Lugar do backend do app de acompanhamento de pedidos (API, worker e Postgres), que vem no projeto do app.
Regras herdadas deste repositório: imagens por tag explícita e digest, rede `suri-net`, nenhuma porta no
host (a entrada é pelo Caddy em `proxy/Caddyfile`), dados só em volumes nomeados cobertos por `backup/`.
```

- [ ] **Step 4: CI e README**

`.github/workflows/ci.yml` (o passo de backup entra na Task 8):
```yaml
name: ci

on:
  push:
    branches: [main]
    tags: ['proxy-v*']
  pull_request:

permissions:
  contents: read
  packages: write

jobs:
  verificar:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - name: shellcheck
        run: shellcheck tests/*.sh
      - name: compose válido
        run: |
          docker compose -f proxy/compose.yaml config -q
          docker compose -f stacks/sites/compose.yaml config -q
      - name: build do proxy
        run: docker build -t suri-proxy:ci proxy/
      - name: varredura Trivy (alta/crítica bloqueia)
        run: >
          docker run --rm -v /var/run/docker.sock:/var/run/docker.sock
          aquasec/trivy:0.75.0@sha256:af6acf9a6b85dfe389a1941505c0ce9efef52a4719635e1a962f022a3d855daa
          image --exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed suri-proxy:ci
      - name: smoke (sobe tudo do zero)
        run: PROXY_IMAGE=suri-proxy:ci tests/smoke.sh
      - name: publicar proxy
        if: startsWith(github.ref, 'refs/tags/proxy-v')
        run: |
          echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u "${{ github.actor }}" --password-stdin
          v="${GITHUB_REF_NAME#proxy-v}"
          docker tag suri-proxy:ci "ghcr.io/suri-tecnologia/suri-proxy:$v"
          docker push "ghcr.io/suri-tecnologia/suri-proxy:$v"
```

`.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: docker
    directory: /proxy
    schedule: { interval: weekly }
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: weekly }
```

`README.md`:
```markdown
# suri-infra

O que roda nos servidores da SURI. Nada é configurado à mão no servidor: tudo sai deste repositório.

| Pasta | O quê |
|---|---|
| `proxy/` | Caddy interno (porta 8088 no host): roteamento por host e cabeçalhos de segurança |
| `stacks/sites/` | site da SURI |
| `stacks/app-risma/` | reservado para o backend do app |
| `backup/` | backup e restauração de volumes nomeados |
| `docs/` | runbooks: subir do zero, migrar para VPS, rollback, registro de aceite |

Publicar uma mudança no proxy: commit + tag `proxy-vX.Y.Z` → o CI publica a imagem → atualizar o tag em `proxy/compose.yaml`.

**Risco aceito:** repositório privado em conta Free do GitHub, sem proteção de branch. Mitigação: só a
organização `suri-tecnologia` (2FA obrigatório) tem acesso, e todo deploy depende de um commit visível
no histórico.
```

- [ ] **Step 5: Commit, criar o repositório privado e enviar** *(ação externa: confirmar com o usuário antes)*

```bash
git add -A
git update-index --chmod=+x tests/smoke.sh
git commit -m "feat: proxy Caddy da SURI, stack do site e smoke test que sobe tudo do zero"
"/c/Program Files/GitHub CLI/gh.exe" repo create suri-tecnologia/suri-infra --private --description "Infraestrutura da SURI (stacks do Portainer)" --source . --remote origin --push
```

- [ ] **Step 6: Acompanhar o CI**

Run: `"/c/Program Files/GitHub CLI/gh.exe" run watch --repo suri-tecnologia/suri-infra --exit-status`
Expected: job `verificar` verde, com o log do smoke terminando em `smoke da infra: ok`, incluindo `origem não confiável → 403` e `sem cabeçalho Server`.

---

### Task 8: Backup de volumes e runbooks

**Files (em `suri-infra`):**
- Create: `backup/backup-volume.sh`, `backup/restore-volume.sh`, `tests/backup.sh`
- Create: `docs/subir-do-zero.md`, `docs/migrar-para-vps.md`, `docs/rollback.md`
- Modify: `.github/workflows/ci.yml` (passo de backup e shellcheck de `backup/`)

**Interfaces:**
- Produces: `backup/backup-volume.sh <volume> <pasta-destino>` → imprime o caminho do `.tar.gz` e falha se o volume não existe ou está vazio; `backup/restore-volume.sh <arquivo.tar.gz> <volume> [--sobrescrever]` → recusa volume com conteúdo sem `--sobrescrever`.

- [ ] **Step 1: Escrever o teste que falha e ligá-lo no CI**

`tests/backup.sh`:
```bash
#!/usr/bin/env bash
# Prova que backup + restauração preservam o conteúdo e que os scripts recusam os casos perigosos.
set -euo pipefail
cd "$(dirname "$0")/.."
ALPINE="alpine:3.24.2@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6"
VOL="suri-teste-backup-$$"
VOL2="${VOL}-restaurado"
VAZIO="${VOL}-vazio"
TMP="$(mktemp -d)"
trap 'docker volume rm -f "$VOL" "$VOL2" "$VAZIO" >/dev/null 2>&1 || true; rm -rf "$TMP"' EXIT

docker volume create "$VOL" >/dev/null
docker run --rm -v "$VOL":/v "$ALPINE" sh -c 'echo "conteúdo de teste" > /v/a.txt && mkdir -p /v/sub && head -c 4096 /dev/urandom > /v/sub/b.bin'
soma() { docker run --rm -v "$1":/v:ro "$ALPINE" sh -c 'cd /v && find . -type f | sort | xargs sha256sum'; }
antes=$(soma "$VOL")

arquivo=$(backup/backup-volume.sh "$VOL" "$TMP")
backup/restore-volume.sh "$arquivo" "$VOL2"
[ "$(soma "$VOL2")" = "$antes" ] || { echo "FALHA: conteúdo restaurado difere do original"; exit 1; }
echo "ok    restauração idêntica"

if backup/restore-volume.sh "$arquivo" "$VOL2" 2>/dev/null; then echo "FALHA: restaurou por cima sem --sobrescrever"; exit 1; fi
echo "ok    recusa sobrescrever sem --sobrescrever"

backup/restore-volume.sh "$arquivo" "$VOL2" --sobrescrever >/dev/null
[ "$(soma "$VOL2")" = "$antes" ] || { echo "FALHA: --sobrescrever não deixou o volume igual ao backup"; exit 1; }
echo "ok    --sobrescrever"

docker volume create "$VAZIO" >/dev/null
if backup/backup-volume.sh "$VAZIO" "$TMP" 2>/dev/null; then echo "FALHA: aceitou backup de volume vazio"; exit 1; fi
echo "ok    recusa backup de volume vazio"

if backup/backup-volume.sh "volume-que-nao-existe-$$" "$TMP" 2>/dev/null; then echo "FALHA: aceitou volume inexistente"; exit 1; fi
echo "ok    recusa volume inexistente"
echo "backup e restauração: ok"
```

Em `.github/workflows/ci.yml`, troque o passo `shellcheck` por `run: shellcheck tests/*.sh backup/*.sh` e acrescente, depois do smoke:
```yaml
      - name: backup e restauração
        run: tests/backup.sh
```

- [ ] **Step 2: Enviar e ver falhar**

```bash
git add -A && git update-index --chmod=+x tests/backup.sh
git commit -m "test: backup e restauração de volume nomeado"
git push
"/c/Program Files/GitHub CLI/gh.exe" run watch --repo suri-tecnologia/suri-infra --exit-status
```
Expected: FAIL no shellcheck (`backup/*.sh: openBinaryFile: does not exist`).

- [ ] **Step 3: Implementar os scripts**

`backup/backup-volume.sh`:
```bash
#!/usr/bin/env bash
# Gera um .tar.gz datado com o conteúdo de um volume Docker nomeado e imprime o caminho dele.
# Uso: backup/backup-volume.sh <volume> <pasta-destino>
set -euo pipefail
VOLUME="${1:?uso: backup-volume.sh <volume> <pasta-destino>}"
DESTINO="${2:?uso: backup-volume.sh <volume> <pasta-destino>}"
ALPINE="alpine:3.24.2@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6"

docker volume inspect "$VOLUME" >/dev/null 2>&1 || { echo "volume não existe: $VOLUME" >&2; exit 1; }
mkdir -p "$DESTINO"
DESTINO_ABS="$(cd "$DESTINO" && pwd)"
ARQUIVO="${VOLUME}-$(date +%Y%m%d-%H%M%S).tar.gz"

docker run --rm -v "$VOLUME":/origem:ro -v "$DESTINO_ABS":/destino -e ARQUIVO="$ARQUIVO" "$ALPINE" \
  sh -c 'tar czf "/destino/$ARQUIVO" -C /origem .'

# Um backup sem nenhum arquivo quase sempre é o volume errado: falhar alto em vez de entregar um .tar vazio
arquivos=$(tar tzf "$DESTINO_ABS/$ARQUIVO" | grep -vc '/$' || true)
if [ "$arquivos" -eq 0 ]; then
  rm -f "$DESTINO_ABS/$ARQUIVO"
  echo "backup vazio: o volume $VOLUME não tem arquivos — confira se é o volume certo" >&2
  exit 1
fi
echo "$DESTINO_ABS/$ARQUIVO"
```

`backup/restore-volume.sh`:
```bash
#!/usr/bin/env bash
# Restaura num volume nomeado um backup gerado por backup-volume.sh.
# Uso: backup/restore-volume.sh <arquivo.tar.gz> <volume> [--sobrescrever]
set -euo pipefail
ARQUIVO="${1:?uso: restore-volume.sh <arquivo.tar.gz> <volume> [--sobrescrever]}"
VOLUME="${2:?uso: restore-volume.sh <arquivo.tar.gz> <volume> [--sobrescrever]}"
MODO="${3:-}"
ALPINE="alpine:3.24.2@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6"

[ -f "$ARQUIVO" ] || { echo "arquivo não encontrado: $ARQUIVO" >&2; exit 1; }
PASTA_ABS="$(cd "$(dirname "$ARQUIVO")" && pwd)"
NOME="$(basename "$ARQUIVO")"

docker volume create "$VOLUME" >/dev/null
conteudo=$(docker run --rm -v "$VOLUME":/alvo:ro "$ALPINE" sh -c 'ls -A /alvo | head -1')
if [ -n "$conteudo" ] && [ "$MODO" != "--sobrescrever" ]; then
  echo "o volume $VOLUME não está vazio; use --sobrescrever para apagar o conteúdo atual" >&2
  exit 1
fi

docker run --rm -v "$VOLUME":/alvo -v "$PASTA_ABS":/origem:ro -e NOME="$NOME" "$ALPINE" \
  sh -c 'find /alvo -mindepth 1 -delete && tar xzf "/origem/$NOME" -C /alvo'
echo "restaurado: $ARQUIVO → $VOLUME"
```

- [ ] **Step 4: Runbooks**

`docs/subir-do-zero.md`:
````markdown
# Subir a infraestrutura da SURI do zero

Vale para qualquer servidor com Docker Engine 24+ e plugin compose. O CI (`tests/smoke.sh`) executa
estes mesmos passos a cada push, num runner limpo.

## Variáveis

| Variável | Servidor do cartório (hoje) | VPS (ver `migrar-para-vps.md`) |
|---|---|---|
| `SURI_BIND` | `192.168.2.50` | `0.0.0.0` |
| `SURI_PROXY_CONFIAVEL` | `192.168.2.1/32` (OPNsense) | faixas de IP da Cloudflare |

## Pelo Portainer (forma padrão)

1. **Registry:** *Registries → Add registry → Custom*: URL `ghcr.io`, usuário do GitHub e token clássico
   só com `read:packages`. É necessário porque a imagem `suri-proxy` é privada.
2. **Stack `suri-proxy` (primeiro, porque cria a rede `suri-net`):** *Stacks → Add stack → Repository*.
   - Repository URL: `https://github.com/suri-tecnologia/suri-infra`
   - Reference: `refs/heads/main`
   - Compose path: `proxy/compose.yaml`
   - Authentication: ligado, com token fine-grained só de leitura (Contents: Read) no repositório `suri-infra`
   - GitOps updates: **desligado no servidor do cartório**. Cada deploy é manual (*Pull and redeploy*), para
     que um push no GitHub, sozinho, nunca chegue ao servidor. Na VPS da SURI, pode ser ligado (*Polling*, `5m`).
   - Environment variables: `SURI_BIND` e `SURI_PROXY_CONFIAVEL` (tabela acima)
3. **Stack `suri-sites`:** igual, com Compose path `stacks/sites/compose.yaml` e sem variáveis.

## Pela linha de comando (alternativa e emergência)

```bash
git clone https://github.com/suri-tecnologia/suri-infra && cd suri-infra
docker login ghcr.io   # usuário do GitHub + token read:packages
SURI_BIND=192.168.2.50 SURI_PROXY_CONFIAVEL=192.168.2.1/32 docker compose -f proxy/compose.yaml up -d
docker compose -f stacks/sites/compose.yaml up -d
```

## Verificação

- `docker ps --filter name=suri` → os dois containers `Up (healthy)`.
- De uma máquina **fora** da lista confiável: `curl -H 'Host: suritecnologia.com' http://<SURI_BIND>:8088/` → `403`.
- Do proxy de borda: o mesmo comando → `200`.
````

`docs/migrar-para-vps.md`:
```markdown
# Migrar a SURI do servidor do cartório para uma VPS

Pré-requisito: VPS com Docker Engine 24+, plugin compose e Portainer CE.

1. **Subir as stacks** seguindo `subir-do-zero.md`, com `SURI_BIND=0.0.0.0`.
2. **Dados:** para cada volume nomeado com estado (hoje nenhum; o app trará o Postgres):
   no servidor antigo, `backup/backup-volume.sh <volume> ~/backups`; copiar o `.tar.gz` para a VPS
   (`scp`); na VPS, **com a stack parada**, `backup/restore-volume.sh <arquivo> <volume>`.
3. **Origem só pela Cloudflare:** na VPS não há OPNsense. Defina `SURI_PROXY_CONFIAVEL` com as faixas
   publicadas em `https://www.cloudflare.com/ips-v4` e `https://www.cloudflare.com/ips-v6`, separadas por
   espaço. O mesmo mecanismo que hoje aceita só o OPNsense passa a aceitar só a Cloudflare. No firewall
   da VPS, abra a porta do proxy só para essas faixas.
4. **TLS:** em `proxy/Caddyfile`, troque `http://suritecnologia.com` por `suritecnologia.com` (e o mesmo
   para `www`), retire `auto_https off` e `http_port 8080`, e publique `80` e `443` em `proxy/compose.yaml`
   no lugar de `8088`. O Caddy emite o certificado sozinho. Publique como nova tag `proxy-v*`.
5. **WAF:** o naxsi do OPNsense deixa de existir. Ative as regras gerenciadas de WAF da Cloudflare para
   o domínio antes de trocar o DNS.
6. **DNS:** na Cloudflare, aponte `suritecnologia.com` e `www` para o IP da VPS (com proxy ligado).
7. **Conferir:** repetir as checagens de `aceite.md` contra o domínio.
8. **Desligar no cartório:** remover as stacks `suri-sites` e `suri-proxy` do Portainer do cartório e
   o vhost correspondente no nginx do OPNsense.
```

`docs/rollback.md`:
```markdown
# Voltar uma versão

As versões em produção são as tags em `proxy/compose.yaml` e `stacks/sites/compose.yaml`.

1. `git revert <commit que trocou a tag>` e `git push`.
2. No Portainer (rede interna, `https://192.168.2.50:9443`): *Stacks → <stack> → Pull and redeploy*.
   No servidor do cartório, o deploy é sempre manual. Sem esse clique, nada muda no ar.
3. Conferir a versão no ar: `curl -s https://suritecnologia.com/ | grep -o 'data-versao="[^"]*"'`.
```

- [ ] **Step 5: Enviar e ver passar**

```bash
git add -A
git update-index --chmod=+x backup/backup-volume.sh backup/restore-volume.sh
git commit -m "feat: backup e restauração de volumes, runbooks de subida, migração e rollback"
git push
"/c/Program Files/GitHub CLI/gh.exe" run watch --repo suri-tecnologia/suri-infra --exit-status
```
Expected: verde, com `backup e restauração: ok` e `smoke da infra: ok` no log.

---

### Task 9: Decisões pendentes e versão 1.0.0

**Files:**
- Modify: `site_SURI/src/config/site.json`, `site_SURI/src/content/politicas/app-v1-0.md`, `site_SURI/src/content/politicas/suri-v1-0.md`, `site_SURI/src/content/cartorios/risma.md`, `site_SURI/package.json`

**Interfaces:**
- Consumes: `pendencias()` e `npm run test:release` (Task 2); CI de tags (Tasks 6 e 7).
- Produces: imagens `ghcr.io/suri-tecnologia/site-suri:1.0.0` e `ghcr.io/suri-tecnologia/suri-proxy:1.0.0`.

- [ ] **Step 1: Coletar as decisões com o usuário**

Perguntar e registrar a resposta literal:
1. Nome do app e slug da URL. O slug não deve mudar depois de cadastrado nas lojas.
2. Encarregado (DPO) da SURI: nome e e-mail.
3. E-mail de contato da SURI. WhatsApp é opcional (só dígitos, com DDI e DDD).
4. Data de publicação (`vigente_desde`). Não pode ser posterior ao dia do build.

- [ ] **Step 2: Aplicar**

Em `src/config/site.json`, preencha `contato`, `encarregado` e `app` com as respostas, com `"nomeDefinitivo": true`. Atualize `vigente_desde` nas duas políticas e `atendido_desde` em `risma.md` para a data informada. Mude `"version"` do `package.json` para `"1.0.0"`.

- [ ] **Step 3: Rodar as duas suítes**

Run: `npm test && npm run test:release`
Expected: PASS nas duas. Se `test:release` falhar, a mensagem diz exatamente qual campo falta.

- [ ] **Step 4: Commit, tag e publicação do site**

```bash
git add -A
git commit -m "chore: dados definitivos (app, encarregado, contato) e versão 1.0.0"
git tag v1.0.0
git push origin main v1.0.0
"/c/Program Files/GitHub CLI/gh.exe" run watch --repo suri-tecnologia/site-suri --exit-status
```
Expected: CI verde, incluindo `checagem de publicação (pendências)`. A imagem `site-suri:1.0.0` aparece no GHCR.

- [ ] **Step 5: Publicar o proxy 1.0.0**

Em `C:\projetos_claude\suri-infra`:
```bash
git tag proxy-v1.0.0
git push origin proxy-v1.0.0
"/c/Program Files/GitHub CLI/gh.exe" run watch --repo suri-tecnologia/suri-infra --exit-status
```
Expected: CI verde e imagem `suri-proxy:1.0.0` publicada. `proxy/compose.yaml` e `stacks/sites/compose.yaml` já apontam para `1.0.0`.

---

### Task 10: Implantação no Portainer do servidor do cartório

Mudança no servidor: **o usuário executa na interface do Portainer**, e o Claude verifica por SSH só com leitura. Confirmar com o usuário antes de começar.

**Interfaces:**
- Consumes: imagens `1.0.0` (Task 9), `docs/subir-do-zero.md` (Task 8).
- Produces: stacks `suri-proxy` e `suri-sites` em produção; Caddy em `192.168.2.50:8088`.

- [ ] **Step 1: Tokens (usuário, no GitHub)**

1. Token clássico com **só** `read:packages` (para o registry do Portainer).
2. Token fine-grained: dono `suri-tecnologia`, repositório só `suri-infra`, permissão **Contents: Read-only**. Se a organização exigir aprovação de tokens, aprovar em *Settings → Personal access tokens → Pending requests*.

Os dois tokens vão direto para o Portainer. Não colar no chat.

- [ ] **Step 2: Registry e stacks (usuário, no Portainer)**

Seguir `suri-infra/docs/subir-do-zero.md` → "Pelo Portainer", com `SURI_BIND=192.168.2.50` e `SURI_PROXY_CONFIAVEL=192.168.2.1/32`. Criar `suri-proxy` primeiro e `suri-sites` depois.

- [ ] **Step 3: Verificar no servidor (Claude, só leitura)**

```bash
ssh -i ~/.ssh/ubuntu_web_diag -o IdentitiesOnly=yes -o BatchMode=yes claude-diag@192.168.2.50 \
  'docker ps --filter name=suri --format "{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}";
   docker inspect --format "{{.Name}} ro={{.HostConfig.ReadonlyRootfs}} capdrop={{.HostConfig.CapDrop}}" $(docker ps -q --filter name=suri);
   curl -s -o /dev/null -w "do próprio servidor: %{http_code}\n" -H "Host: suritecnologia.com" http://192.168.2.50:8088/'
```
Expected: dois containers `Up ... (healthy)`; `site-suri` sem coluna de portas; `ro=true capdrop=[ALL]` nos dois; **`do próprio servidor: 403`** (o servidor não é o proxy confiável).

```bash
ssh -i ~/.ssh/opnsense_risma_diag -o IdentitiesOnly=yes -o BatchMode=yes root@192.168.2.1 'sh -s' <<'EOF' 2>/dev/null | tail -3
curl -s -o /dev/null -w "do OPNsense: %{http_code}\n" -H "Host: suritecnologia.com" http://192.168.2.50:8088/
curl -s -H "Host: suritecnologia.com" http://192.168.2.50:8088/ | grep -o 'data-versao="[^"]*"'
EOF
```
Expected: `do OPNsense: 200` e `data-versao="1.0.0"`.

---

### Task 11: Publicação — Cloudflare e OPNsense

Mudanças na Cloudflare e no OPNsense: **o usuário executa**, e o Claude orienta e verifica. Confirmar antes de começar.

**Interfaces:**
- Consumes: Caddy em `192.168.2.50:8088` respondendo 200 ao OPNsense (Task 10).
- Produces: `https://suritecnologia.com` e `https://www.suritecnologia.com` no ar.

- [ ] **Step 1: Cloudflare (usuário)**

1. *DNS*: apagar os registros atuais de `suritecnologia.com` (raiz) que apontam para a Hostinger. Criar `A suritecnologia.com` → **o mesmo IP de destino do registro `chatwoot`**, com proxy ligado (nuvem laranja). Criar `CNAME www` → `suritecnologia.com`, com proxy ligado.
2. *Scrape Shield → Email Address Obfuscation*: **desligar**.
3. *Speed → Optimization*: **Rocket Loader desligado**.
4. *Analytics → Web Analytics*: **sem injeção automática** para o domínio.
Os itens 2 a 4 evitam scripts injetados pela Cloudflare (Review Focus 3).

- [ ] **Step 2: Certificado no OPNsense (usuário)**

O OPNsense usa um certificado **curinga** `*.suritecnologia.com` (validação por DNS; o vigente foi emitido em 27/08/2026 e vence em 25/11/2026). O curinga cobre `www`, mas **não** o domínio raiz.
*Services → ACME Client → Certificates*: edite o certificado `*.suritecnologia.com` vigente e acrescente `suritecnologia.com` em *Alt Names*. Salve, clique em *Issue/Renew* e confira o status verde. O mesmo certificado passa a servir chatwoot, raiz e `www`.
Verificação (Claude, leitura): `openssl x509 -in /usr/local/etc/nginx/key/<arquivo do vhost>.pem -noout -ext subjectAltName` lista `*.suritecnologia.com` e `suritecnologia.com`.
Limpeza opcional: apagar a entrada antiga de 27/02/2026, que já venceu.

- [ ] **Step 3: Vhost no nginx do OPNsense (usuário)**

Em *Services → Nginx → Configuration*, copiando as opções do vhost do `chatwoot` (mesma política naxsi):
1. *Upstream → Upstream Server*: `192.168.2.50`, porta `8088`.
2. *Upstream → Upstream*: usando o servidor acima.
3. *HTTP(S) → Location*: `/`, upstream acima, mesmas regras naxsi do chatwoot.
4. *HTTP(S) → HTTP Server*: listen 443 com HTTPS, server names `suritecnologia.com` e `www.suritecnologia.com`, certificado do Step 2, location do item 3, redirecionamento de HTTP para HTTPS.
5. *Apply*.

- [ ] **Step 4: Origem só pela Cloudflare (usuário, com orientação do Claude)**

Hoje a WAN aceita 80/443 de qualquer origem (achado 7). Antes de mexer, o Claude confere por leitura que todos os vhosts do nginx do OPNsense (`server_name`) estão com proxy da Cloudflare. Se algum host for acessado direto pelo IP, ele fica de fora desta restrição ou ganha proxy primeiro.
1. *Firewall → Aliases → +*: nome `cloudflare_ips`, tipo **URL Table (IPs)**, URL `https://www.cloudflare.com/ips-v4`, atualização diária. Crie um segundo alias com `https://www.cloudflare.com/ips-v6` se a WAN tiver IPv6.
2. *Firewall → Rules → WAN*: nas regras que liberam `http` e `https` para *This Firewall*, troque a origem `any` por `cloudflare_ips`. Desmarque *Log* se as regras ficarem barulhentas.
3. Na Cloudflare: *SSL/TLS → Overview* → modo **Full (strict)**.
4. *Apply*. Verificação (Claude): `https://chatwoot.suritecnologia.com` e `https://suritecnologia.com` continuam com 200. Depois, `pfctl -sr | grep 'port = https'` no OPNsense (leitura) mostra `from <cloudflare_ips>`.
5. A renovação do certificado não é afetada: o curinga é validado por DNS, sem conexão de entrada na WAN.
6. Nomes desconhecidos: hoje, um pedido com qualquer nome cai no vhost do chatwoot (servidor padrão). Crie um *HTTP Server* padrão (*Default server* marcado) que só responda 444/fechar conexão, para o nginx recusar nomes que não conhece. Verificação (Claude): `curl -sk --resolve x.suritecnologia.com:443:127.0.0.1 https://x.suritecnologia.com/` no OPNsense não devolve o chatwoot.

- [ ] **Step 5: Guarda dos registros de acesso por 6 meses (Claude verifica; usuário ajusta se preciso)**

As políticas afirmam guardar os registros de acesso por **6 meses**. O Caddy não grava log; quem grava é o nginx do OPNsense. Verificação por leitura:
```bash
ssh -i ~/.ssh/opnsense_risma_diag -o IdentitiesOnly=yes -o BatchMode=yes root@192.168.2.1 'sh -s' <<'EOF' 2>/dev/null | tail -15
ls -la /var/log/nginx/ | head -20
grep -rE 'nginx' /usr/local/etc/newsyslog.conf.d/ /etc/newsyslog.conf 2>/dev/null
EOF
```
Se a retenção for menor que 6 meses, o usuário ajusta em *System → Settings → Logging* (dias de retenção ≥ 183) e confere o espaço em disco. O texto das políticas só fica como está se a retenção real for de pelo menos 6 meses. Caso contrário, ajuste o texto antes da versão 1.0.0.

- [ ] **Step 6: Verificar de fora (Claude)**

```bash
curl -sI https://suritecnologia.com/ | tr -d '\r' | grep -iE '^(http/|content-security|strict-transport|x-frame|server)'
curl -s -o /dev/null -w 'www: %{http_code} → %{redirect_url}\n' https://www.suritecnologia.com/privacidade/
curl -s https://suritecnologia.com/ | grep -o 'data-versao="[^"]*"'
SLUG=$(jq -r .app.slug /c/projetos_claude/site_SURI/src/config/site.json)
curl -s -o /dev/null -w "política do app: %{http_code}\n" "https://suritecnologia.com/apps/$SLUG/privacidade/"
```
Expected: `HTTP/2 200`; CSP e HSTS presentes; `Server: cloudflare` (o do Caddy e o do nginx não aparecem); `www: 301 → https://suritecnologia.com/privacidade/`; `data-versao="1.0.0"`; `política do app: 200`.

---

### Task 12: Aceite

**Files (em `suri-infra`):**
- Create: `docs/aceite.md`

- [ ] **Step 1: Cabeçalhos (critério 2)**

```bash
curl -sI "https://securityheaders.com/?q=https://suritecnologia.com/&hide=on&followRedirects=on" | tr -d '\r' | grep -i '^x-grade'
curl -s -X POST "https://observatory-api.mdn.mozilla.net/api/v2/scan?host=suritecnologia.com" | jq '{grade, score, tests_failed}'
```
Expected: `x-grade: A` ou `A+`; Observatory com `grade` `A` ou melhor. Se faltar alguma coisa, ajuste o `Caddyfile`, publique `proxy-v1.0.1` e repita.

- [ ] **Step 2: Nada injetado pela Cloudflare (Review Focus 3)**

```bash
curl -s https://suritecnologia.com/ | grep -Eic 'cdn-cgi|email-protection|cloudflareinsights|<script' || true
```
Expected: `0`.

- [ ] **Step 3: Lighthouse (critério 3)**

Com a ferramenta `lighthouse_audit` do chrome-devtools (MCP), nas URLs `https://suritecnologia.com/` e `https://suritecnologia.com/apps/<slug>/privacidade/`, em modo mobile.
Expected: Acessibilidade ≥ 90 e Boas práticas ≥ 90 nas duas. Corrija o que ficar abaixo antes de seguir.

- [ ] **Step 4: Rollback de verdade (critério 6)**

1. No `site-suri`: `npm version patch -m "chore: %s para teste de rollback"` (gera o commit e a tag `v1.0.1`), depois `git push origin main --follow-tags` e espere o CI.
2. No `suri-infra`: troque `site-suri:1.0.0` por `site-suri:1.0.1` em `stacks/sites/compose.yaml`, depois `git commit -am "deploy: site 1.0.1"` e `git push`. Espere 10 minutos **sem** clicar em nada e rode `curl -s https://suritecnologia.com/ | grep -o 'data-versao="[^"]*"'` → deve continuar `1.0.0`. Isso prova que o push sozinho não chega ao servidor.
3. Usuário: *Pull and redeploy* na stack `suri-sites`. A mesma checagem → `1.0.1`.
4. Rollback conforme `docs/rollback.md`: `git revert --no-edit HEAD`, `git push` e *Pull and redeploy*. A mesma checagem → `1.0.0`.
5. Avance de novo para `1.0.1` (`git revert --no-edit HEAD`, `git push` e *Pull and redeploy*) e confira.

- [ ] **Step 5: Monitoramento (usuário)**

No UptimeRobot (conta gratuita), crie um monitor HTTP(S) para `https://suritecnologia.com/apps/<slug>/privacidade/`, com intervalo de 5 minutos e alerta por e-mail.

- [ ] **Step 6: Registrar o aceite**

Crie `docs/aceite.md` com esta tabela e preencha as colunas "Resultado" e "Evidência" com os valores reais obtidos nos passos acima (nota, link do run do CI, data):
```markdown
# Aceite — site SURI e hospedagem portátil

| # | Critério (spec §6) | Resultado | Evidência |
|---|---|---|---|
| 1 | 7 páginas com HTTPS, sem links quebrados | | `tests/transversal.test.ts` + Task 11 Step 6 |
| 2 | Nota A em cabeçalhos | | securityheaders e Observatory |
| 3 | Lighthouse ≥ 90 (acessibilidade, boas práticas) | | home e política do app |
| 4 | Trivy sem CVE alta/crítica | | run do CI da v1.0.1 |
| 5 | Sobe do zero só com git + runbook | | run do CI com `smoke da infra: ok` |
| 6 | Rollback testado | | 1.0.1 → 1.0.0 → 1.0.1 |
```

```bash
git add docs/aceite.md && git commit -m "docs: registro do aceite" && git push
```

---

## Depois deste plano (fora do escopo, registrado para não se perder)

- **Revisão jurídica das políticas:** depois dela, publicar a versão revisada com `revisao_juridica: true` (arquivo novo `app-v1-1.md` / `suri-v1-1.md` se o texto mudar; se não mudar, só a flag na 1.0) e só então cadastrar a URL nas lojas. Até lá, as páginas mostram o aviso de minuta e ficam fora dos buscadores.
- **Liberação de `8080` na WAN do OPNsense** (achado 7): identificar o que responde nela e fechar, se não for usada.
- **Porta 9000 (HTTP sem TLS) do Portainer na rede local:** recriar o container publicando só a 9443, numa janela depois das 17h.
- **DMZ para o servidor 192.168.2.50:** separar o servidor da LAN do cartório antes do backend do app.
- **Pendências antigas no mesmo servidor:** trocar a senha do Postgres do n8n (deixa de valer quando o n8n for apagado, Task 0 Step 4) e a senha de root do OPNsense; tirar o chatwoot da tag `latest`.
- **Projeto do app:** contas das lojas e D-U-N-S em nome da SURI, e o risco da regra 4.2.6 (spec §9).
