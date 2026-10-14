# Status do projeto — site SURI + hospedagem portátil

**Última atualização:** 14/10/2026

## Documentos

- Spec (aprovada em 14/10/2026): `docs/superpowers/specs/2026-10-14-site-suri-hospedagem-design.md`
- Plano (Tasks 0 a 12): `docs/superpowers/plans/2026-10-14-site-suri-hospedagem.md`

## Feito

- Organização `suri-tecnologia` criada no GitHub (plano Free, 2FA obrigatório); `gh` autenticado como `rodrigosuri`
  (escopos `repo`, `workflow`, `admin:org`, `write:packages`). Nesta máquina, usar `"/c/Program Files/GitHub CLI/gh.exe"`
  até reiniciar o terminal.
- **Task 0 concluída:** n8n parado (`restart=no`, dados em `/root/n8n/`, backup em `~/n8n_backup_20261007/`);
  DNS `n8n` e `portainer` removidos da Cloudflare; HTTP Servers dos dois apagados no nginx do OPNsense.
  Portainer só pela rede interna: `https://192.168.2.50:9443`.

## Próximo passo

- Escolher a forma de execução do plano (recomendado: **nativa**, com revisor no fim) e começar pela Task 1.
- Task 0 Step 4: apagar o n8n de vez a partir de 13/11/2026, se nada fez falta.

## Decisões pendentes do usuário (bloqueiam só a Task 9)

- Nome do app e slug da URL
- Encarregado (DPO) da SURI: nome e e-mail
- E-mail de contato (WhatsApp opcional)
- Revisão jurídica das políticas (antes de cadastrar nas lojas)

## Achados de segurança fora do escopo

- WAN do OPNsense aceita 80/443 de qualquer origem → restringir à Cloudflare (está na Task 11)
- Liberação de 8080 (http-alt) na WAN, sem uso conhecido
- Portainer escuta na 9000 sem TLS na rede local
- Servidor 192.168.2.50 na mesma LAN do cartório → DMZ antes do backend do app
- Senha de root do OPNsense e senhas vazadas do n8n; chatwoot na tag `latest`
- Certificado curinga antigo (27/02/2026, vencido) pode ser apagado no ACME Client
