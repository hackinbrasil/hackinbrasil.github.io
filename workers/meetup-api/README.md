# Meetup API Worker (Cloudflare)

API serverless para inscrições de meetup, com limite de vagas rígido (sem lista de espera).

## Endpoints

- `GET /api/meetups/:slug/status`
- `POST /api/meetups/:slug/register`

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
```

`DOC_ENCRYPTION_KEY_BASE64` deve ser uma chave AES-256 em Base64 (32 bytes).

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
