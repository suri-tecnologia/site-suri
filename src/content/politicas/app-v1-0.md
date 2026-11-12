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
