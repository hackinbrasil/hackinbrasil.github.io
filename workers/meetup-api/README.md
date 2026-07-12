# Meetup API Worker (Cloudflare)

API serverless para inscrições de meetup, com limite de vagas rígido (sem lista de espera).
Também agenda e envia e-mails de confirmação com atraso de 10 minutos.

## Endpoints

- `GET /api/meetups/:slug/status`
- `POST /api/meetups/:slug/register`
- `POST /api/sponsors` — solicitações de patrocínio (substitui o formulário do Airtable)
- `POST /api/talks` — propostas de palestra / Call for Papers (substitui o formulário do Airtable)

## Solicitações de patrocínio (`POST /api/sponsors`)

- Campos: `company`, `website`, `contactName`, `role`, `email`, `phone`, `message`, `captcha`.
- Armazenados em texto puro na tabela `sponsor_requests` (dados de contato comercial, não CPF).
- Cada envio dispara imediatamente um e-mail via Resend para `SPONSOR_NOTIFY_EMAIL`
  (padrão `contato@hackinbrasil.com.br`), com `reply_to` apontando para o e-mail da empresa.
- Frontend: página nativa `quero-patrocinar.html` (`/quero-patrocinar/`) + `assets/js/sponsor-registration.js`.
- Migração da tabela: `migrations/0009_sponsor_requests.sql`.

## Propostas de palestra (`POST /api/talks`)

- Campos: `title`, `abstract`, `speakerName`, `email`, `phone` (opcional), `photoUrl`,
  `bio`, `inPerson` (`sim`/`nao`), `imageConsent`, `termsAck`, `captcha`.
- Armazenados em texto puro na tabela `talk_proposals`.
- Cada envio dispara imediatamente um e-mail via Resend para `TALK_NOTIFY_EMAIL`
  (padrão `contato@hackinbrasil.com.br`), com `reply_to` apontando para o e-mail da pessoa palestrante.
- `photoUrl` aceita apenas URLs `http`/`https`; consentimento de imagem e ciência das orientações são obrigatórios.
- Frontend: página nativa `submeter-palestra.html` (`/submeter-palestra/`) + `assets/js/talk-submission.js`.
- Migração da tabela: `migrations/0010_talk_proposals.sql`.

## Dados coletados

- `name`
- `email`
- `document` (armazenado criptografado)
- `consentLgpd`

## Regras de lotação

- Sem waitlist.
- Ao atingir `capacity`, novas inscrições retornam erro e o frontend desabilita o botão.

## Setup

1. Criar D1 e atualizar `database_id` em `wrangler.toml`.
   Configure também `ALLOWED_ORIGIN` com os domínios permitidos (separados por vírgula), por exemplo:

```toml
ALLOWED_ORIGIN = "https://hackinbrasil.com.br,https://www.hackinbrasil.com.br"
```

2. Instalar dependências:

```bash
cd workers/meetup-api
npm install
```

3. Aplicar migração:

```bash
npx wrangler d1 migrations apply meetup_db --remote
```

4. Definir secret:

```bash
npx wrangler secret put DOC_ENCRYPTION_KEY_BASE64
npx wrangler secret put RESEND_API_KEY
```

`DOC_ENCRYPTION_KEY_BASE64` deve ser uma chave AES-256 em Base64 (32 bytes).
`RESEND_API_KEY` é a chave privada da API do Resend.

5. Deploy:

```bash
npx wrangler deploy
```

## Integração com Jekyll

No formulário da página do meetup, ajustar:

- `data-api-base="https://SEU-WORKER-DOMAIN"`
- `data-meetup-slug="meetup-25-03-2026"`

Arquivo integrado: `assets/js/meetup-registration.js`.

Comportamento de UX atual:

- Exibe apenas status de disponibilidade: "Inscrições abertas" ou "Inscrições encerradas"
- Não exibe quantidade de vagas
- Feedback de sucesso/erro em modal com botão de fechar (X)

## Segurança / LGPD

- Documento criptografado no banco.
- Consentimento obrigatório (`consentLgpd=true`).
- CPF validado no frontend e no backend (estrutura + dígitos verificadores).
- Recomenda-se adicionar captcha e política de retenção dos dados.

## E-mails de confirmação

- O e-mail é agendado no momento da inscrição para envio após 10 minutos.
- O envio ocorre via trigger de cron do Worker (`*/2 * * * *`).
- O conteúdo do e-mail é definido no banco em `email_templates`.
- Inscrições antigas são carregadas para envio na primeira aplicação da migração `0002`.
- Para editar próximas mensagens, atualize o registro em `email_templates`.
- O limite diário está fixo em 100 envios.
- Quando o envio falha, a próxima tentativa é reagendada para 24 horas depois (até 5 tentativas).
