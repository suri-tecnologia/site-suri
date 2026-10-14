# Site SURI + hospedagem portátil — Design

**Data:** 14/10/2026
**Status:** aguardando revisão do usuário
**Pasta do projeto:** `C:\projetos_claude\site_SURI` (vira o repositório `site-suri` no GitHub)

## 1. Contexto e objetivo

A SURI Tecnologia vai desenvolver e publicar, **na conta dela**, um app de acompanhamento de pedidos para cartórios de registro de imóveis. O Registro de Imóveis de Santa Maria (RISMA) é o primeiro cliente. Outros cartórios vêm depois. O escopo técnico do app está em `C:\projetos_claude\app_RISMA\Escopo - App RI Santa Maria.pdf` (23/09/2026).

As lojas (App Store e Google Play) exigem política de privacidade, página de suporte e página de exclusão de dados em URLs públicas. Hoje a SURI não tem site. Este projeto entrega:

1. **O site institucional da SURI**, com as páginas legais do app e da própria SURI.
2. **Uma base de hospedagem portátil** no servidor Docker/Portainer existente, que depois recebe o backend do app e se muda para uma VPS da SURI sem retrabalho.

**Sucesso nesta etapa:** `https://suritecnologia.com/apps/<app>/privacidade` publicada com HTTPS, pronta para cadastrar nas lojas, rodando numa stack que sobe do zero só a partir do git.

### 1.1 Restrições

- **O servidor é do cartório.** O 192.168.2.50 (Ubuntu, Docker, Portainer) e o OPNsense (nginx + WAF naxsi) pertencem ao RISMA. O oficial autorizou o uso temporário pela SURI. A SURI vai migrar para uma VPS própria, e depois os sistemas do cartório também passam a ser administrados pela SURI nessa VPS.
- **Por isso, portabilidade e isolamento são requisitos, não extras:** nada configurado à mão no servidor, nada da SURI misturado à rede ou aos volumes dos serviços existentes (chatwoot, n8n).
- **Edição do conteúdo:** o site da SURI é editado pelo usuário com o Claude, via git. Não precisa de editor visual.

### 1.2 Fora de escopo

- **Migração do site do RISMA (Wix).** Decidido em 14/10/2026: o site continua na Wix. Motivo: o registro de DNS do domínio do cartório está em nome de um oficial anterior, sem contato, e o acesso está preso à Wix. A página de privacidade **do site do cartório** (política do cartório como controlador do próprio site) continua no projeto `site_RISMA`.
- Migração de chatwoot e n8n para o padrão novo (fica para a mudança para a VPS).
- Backend do app (API, worker, Postgres). Este projeto só reserva o lugar dele (`stacks/app-risma/`).
- Blog, portfólio, área de cliente, formulário com backend.

## 2. Papéis na LGPD

| Dado | Controlador | Papel da SURI |
|---|---|---|
| Dados do app: token de push, vínculo aparelho–pedido, HMAC de chave+validador, última situação notificada, logs de acesso e de tentativas | SURI | Controladora |
| Dados do registro: situação, histórico, exigência e link da certidão de cada pedido | Cada cartório | Operadora (consulta em nome do cartório) |
| Visitantes do site da SURI | SURI | Controladora (o site não coleta dados; ver §4.4) |

A política do app descreve os dois papéis. A identificação de cada cartório atendido entra como **anexo por cartório**: um arquivo a mais por cliente, sem reescrever a política.

## 3. Arquitetura

### 3.1 Repositórios (organização GitHub `suri-tecnologia`, a criar)

```
suri-infra   (privado) → o que roda no servidor
├── proxy/             Caddyfile + compose do Caddy (porta de entrada da SURI)
├── stacks/sites/      compose do site SURI
├── stacks/app-risma/  reservado para o backend do app
├── backup/            scripts de backup/restauração de volumes nomeados
└── docs/              runbook: subir do zero, migrar p/ VPS, rollback

site-suri    (privado) → código do site (esta pasta)
├── Astro + conteúdo em Markdown
├── Dockerfile          build Astro → nginx-unprivileged só com HTML estático
└── .github/workflows/  build → ghcr.io/suri-tecnologia/site-suri:<versão>
```

Dois repositórios porque a infra muda raramente e afeta tudo, e o site muda sempre: um commit de texto nunca mexe na configuração do servidor.

### 3.2 Fluxo de publicação

```
commit no site-suri
  → GitHub Actions: build Astro → checagem de links → imagem → Trivy → GHCR
  → commit da tag nova em suri-infra (stacks/sites)
  → Portainer (stack via repositório git, atualização automática) aplica
```

- **Deploy só por tag explícita.** Nunca `latest`. O servidor troca de versão apenas quando a tag muda no `suri-infra`.
- **Rollback:** reverter o commit da tag no `suri-infra`.

### 3.3 Caminho de uma requisição

```
Internet → OPNsense (TLS de *.suritecnologia.com + WAF naxsi)
         → Caddy da SURI (192.168.2.50, porta aceita só do IP do OPNsense)
         → container do site (rede suri-net, sem porta no host)
```

- **Uma única regra no OPNsense** encaminha os hosts da SURI para o Caddy. O roteamento entre serviços da SURI (site, depois API e consulta web do app) fica no `Caddyfile`, em git.
- **Rede Docker própria** `suri-net`, separada da dos serviços existentes.
- **TLS hoje no OPNsense**, com o certificado que já existe. Na VPS, o Caddy passa a emitir o próprio certificado (ajuste de uma linha no Caddyfile) e uma proteção equivalente ao naxsi entra no Caddy ou na Cloudflare.

### 3.4 Endereços

| URL | Uso |
|---|---|
| `suritecnologia.com`, `www.suritecnologia.com` | site (o `www` redireciona para o domínio raiz) |
| `suritecnologia.com/apps/<app>/privacidade` | URL cadastrada nas lojas — **estável, não muda de caminho** |

## 4. Site da SURI

### 4.1 Páginas da v1

| Rota | Conteúdo |
|---|---|
| `/` | Institucional: o que a SURI faz, para quem (cartórios), contato |
| `/apps/<app>/` | Vitrine do app: o que faz, como usar (QR da nota de entrega), links das lojas quando existirem |
| `/apps/<app>/privacidade` | Política de privacidade do app |
| `/apps/<app>/suporte` | Suporte e contato (exigência da Apple) |
| `/apps/<app>/excluir-dados` | Como remover pedidos e dados (exigência do Google Play) |
| `/privacidade` | Política da SURI (site, contatos, atendimento) |
| `/lgpd` | Canal do titular: encarregado (DPO) e como exercer os direitos do art. 18 |

Contato só por links de e-mail e WhatsApp. Não há formulário.

### 4.2 Versionamento das políticas

- Cada política é um arquivo Markdown com metadados: `versao`, `vigente_desde`, `resumo_das_mudancas`.
- A página mostra a versão vigente e um link "versões anteriores". Cada versão antiga continua acessível em URL própria (`/apps/<app>/privacidade/v1.0`).
- O histórico do git comprova qual texto estava publicado em cada data.

### 4.3 Conteúdo da política do app

Baseado na seção "LGPD e segurança" do escopo de 23/09/2026:

- Papéis (§2 desta spec).
- Dados tratados e dados **não** coletados (CPF, nome, telefone, e-mail).
- Armazenamento no aparelho (Keychain/Keystore) e no servidor.
- Push: texto genérico, porque passa pelos servidores da Apple e do Google.
- Retenção: vínculo aparelho–pedido apagado 90 dias após a conclusão do pedido, ou na hora em que o usuário remove o pedido.
- Segurança: limite de tentativas, bloqueio temporário, logs, CAPTCHA invisível (Turnstile) na consulta web.
- Direitos do titular e como remover pedidos.
- Anexo por cartório (RISMA como primeiro).

**O texto passa por revisão jurídica antes de ser cadastrado nas lojas.** Isso é uma etapa do plano, não uma opção.

### 4.4 Visual e privacidade do próprio site

- Identidade SURI v1.0.0 (`C:\projetos_claude\identidade visual SURI`): logo opção 03, paleta A (`#0B2A5B` + ciano), Sora + IBM Plex Sans.
- **Fontes servidas pelo próprio site**, sem Google Fonts, para não enviar o IP do visitante a terceiros.
- Sem analytics, sem cookies, sem scripts de terceiros. Assim, a política da SURI pode afirmar que o site não coleta dados.

## 5. Segurança e operação

### 5.1 Container do site

- Imagem `nginxinc/nginx-unprivileged:alpine` (sem root), fixada por **digest**.
- Compose: `read_only: true`, `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`, limites de CPU e memória, `tmpfs` só para cache e PID, healthcheck.
- Nenhuma porta publicada no host.

### 5.2 Cabeçalhos (no Caddy)

`Strict-Transport-Security`, `Content-Security-Policy` com `default-src 'self'` e sem script inline, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (câmera, microfone e localização bloqueados), `frame-ancestors 'none'`.

### 5.3 Cadeia de build e atualização

- Actions: build → checagem de links → imagem → **Trivy** (CVE alta/crítica bloqueia a publicação) → GHCR.
- **Dependabot** nos dois repositórios (Astro, nginx, Caddy, actions). Resposta estrutural às imagens paradas havia meses encontradas na auditoria de 07/10/2026.

### 5.4 Segredos e acessos

- Nenhum segredo no git. O Portainer acessa o GHCR com um token só de leitura, cadastrado como registry no Portainer.
- Organização no GitHub com 2FA obrigatório; `main` protegida nos dois repositórios.
- O Portainer não fica exposto na internet (conferir na implementação).

### 5.5 Backup e portabilidade

- O site não guarda estado: tudo está no git e no GHCR. O Caddy só tem configuração (git).
- `backup/` já nasce com o script genérico de volume nomeado (tar datado + restauração) para quando o app trouxer o Postgres.
- Runbook `docs/migrar-para-vps.md`: instalar Docker e Portainer → apontar as stacks para o `suri-infra` → restaurar volumes → ativar o TLS no Caddy → trocar o DNS.

### 5.6 Monitoramento

Healthcheck no compose + verificador externo gratuito (ex.: UptimeRobot) na URL da política do app.

## 6. Critérios de aceite

1. As 7 páginas abrem com HTTPS na URL pública, sem links quebrados.
2. Nota A no securityheaders.com e no Mozilla Observatory.
3. Lighthouse ≥ 90 em acessibilidade e boas práticas.
4. Trivy sem CVE alta ou crítica na imagem publicada.
5. **Ensaio de portabilidade:** a stack sobe do zero numa máquina descartável (VM ou Docker Desktop) só com o git e o runbook. Qualquer passo manual fora do runbook reprova o ensaio.
6. Rollback testado uma vez de verdade.

## 7. Ações do usuário (fora do alcance do Claude)

- Criar a organização `suri-tecnologia` no GitHub, com 2FA obrigatório.
- Criar no OPNsense a regra que encaminha os hosts da SURI ao Caddy, ou autorizar o Claude a fazer isso (o acesso SSH atual ao OPNsense é só leitura).
- Contratar a revisão jurídica das políticas.

## 8. Decisões pendentes (não bloqueiam o início)

| Decisão | Onde afeta | Até quando |
|---|---|---|
| Nome do app | URLs `/apps/<app>/`, fichas das lojas | antes de publicar as páginas do app |
| Encarregado (DPO) da SURI e e-mail do canal | `/lgpd`, políticas | antes de publicar as políticas |
| O que o domínio raiz `suritecnologia.com` resolve hoje (DNS, site antigo) | troca do DNS | levantamento no início da implementação |

## 9. Impactos registrados para o projeto do app

Decisões desta conversa que alteram o escopo de 23/09/2026 e devem ser levadas para o projeto `app_RISMA`:

- **Quem publica é a SURI, não o cartório.** O número D-U-N-S, a Apple Developer e o Google Play Console passam a ser contas de organização **da SURI**.
- **Risco da regra 4.2.6 da Apple:** apps quase idênticos, gerados a partir de um modelo e publicados por um fornecedor em nome de vários clientes, são rejeitados. Para atender vários cartórios, o caminho seguro é **um único app da SURI** com seleção de cartório (ou cartório identificado pelo QR), não um app por cartório.
- O backend do app sobe em `suri-infra/stacks/app-risma/`, atrás do mesmo Caddy, seguindo as regras de portabilidade desta spec.
