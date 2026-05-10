# Deploy: GitHub, Railway (API) e Vercel (frontend)

## Repositório no GitHub

1. Crie um repositório vazio no GitHub (sem README se já tiver um localmente).
2. Na pasta do projeto:

```bash
git init
git add .
git commit -m "Initial commit: Bazar do Bié monorepo"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
git push -u origin main
```

Confirme que `.gitignore` na raiz ignora `node_modules`, builds e `.env` locais (não faça commit de segredos).

---

## Domínio **bazardobie.com**

Configuração típica:

| O quê | Onde | URL de exemplo |
|-------|------|----------------|
| Site (SPA) | Vercel + DNS | `https://bazardobie.com` ou `https://www.bazardobie.com` |
| API | Railway + DNS | `https://api.bazardobie.com` |

**DNS (no teu registador):**

- **Vercel:** aponta `bazardobie.com` e/ou `www` conforme as instruções do projeto (registo `A`/`CNAME` que a Vercel indica).
- **Railway:** no serviço da API → **Settings → Networking → Custom Domain** → `api.bazardobie.com`; cria o `CNAME` que o Railway pede.

**Variáveis com este domínio (produção):**

- Railway — `PUBLIC_BASE_URL` = `https://api.bazardobie.com` (sem barra no fim).
- Railway — `FRONTEND_URL` = o URL canónico do site (ex. `https://bazardobie.com`); usa o mesmo host que os utilizadores abrem no browser (se redireccionares `www` ↔ apex, escolhe um como «oficial» nesta variável).
- Vercel — `VITE_API_BASE` = `https://api.bazardobie.com/api/v1`.

**OAuth:** redirects autorizados (Google/Facebook):

- `https://api.bazardobie.com/api/v1/auth/oauth/google/callback`
- `https://api.bazardobie.com/api/v1/auth/oauth/facebook/callback`

---

## Railway — API (Node + Prisma + Postgres)

### Serviço

1. Novo projeto Railway → **Deploy from GitHub** → escolha o repo.
2. Para o serviço da API: **Settings → Root Directory** = `backend`.
3. Railway deve detectar `railway.toml` e construir com o **Dockerfile** em `backend/`.

### Base de dados

1. No mesmo projeto, adicione **PostgreSQL** (plugin Railway).
2. Copie a variável **`DATABASE_URL`** que o plugin expõe (ou use **Variable Reference** para ligar ao serviço da API).

### Variáveis de ambiente (API)

Defina no serviço Node (produção):

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | Connection string do Postgres (Railway define automaticamente se referenciares o plugin). |
| `JWT_SECRET` | String longa e aleatória (obrigatória). |
| `PUBLIC_BASE_URL` | URL **pública da API**, ex. `https://api.bazardobie.com` (sem barra final). Usada em OAuth e links. |
| `FRONTEND_URL` | URL canónico do site, ex. `https://bazardobie.com`. |
| `JWT_EXPIRES_IN` | Opcional; ex. `7d`. |
| `PORT` | Railway injecta automaticamente; não é preciso definir manualmente na maioria dos casos. |

OAuth (opcional): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`. Nos painéis Google/Facebook, usa como redirect (com `PUBLIC_BASE_URL` = API):

- `https://api.bazardobie.com/api/v1/auth/oauth/google/callback`
- `https://api.bazardobie.com/api/v1/auth/oauth/facebook/callback`

### Healthcheck

O deploy usa `GET /api/v1/health` (definido em `railway.toml`). Garante que o domínio público aponta para este serviço.

### Uploads

`UPLOAD_DIR` no container é `/app/uploads` por defeito. O disco do container é **efémero**. Cada **novo deploy** (por exemplo `git push` que dispara o build na Railway) cria um contentor novo: as imagens já enviadas deixam de existir **no disco**, embora as linhas na base de dados (URLs tipo `/uploads/…`) continuem — daí as fotos dos vendedores/compradores “sumirem” após atualizar código.

Para persistir ficheiros:

1. Railway → projecto → serviço **da API Node** → **Settings** → **Volumes** → **Create volume** → **Mount path** = **`/app/uploads`** (tem de coincidir com `UPLOAD_DIR`).
2. (Opcional) Variável **`UPLOAD_VOLUME_MOUNTED=true`** no mesmo serviço para silênciar o aviso no arranque da API quando o volume já está configurado.

**Cloudflare R2 (recomendado):** com as variáveis `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` e `R2_PUBLIC_BASE_URL` definidas na API, os novos uploads são enviados para o balde S3-compatível e a resposta do endpoint de upload devolve uma URL `https://...` (em vez de `/uploads/...`). No painel R2, active o subdomínio público **R2.dev** ou um domínio personalizado para o balde; `R2_PUBLIC_BASE_URL` deve ser exactamente a origem pública (ex. `https://pub-xxxx.r2.dev`), sem barra no fim.

### Migrações

**O que o `git push` faz:** apenas actualiza o repositório. **Não corre migrações** na base de dados.

**Quando é automático:** se a API em produção arranca com o **`backend/Dockerfile`** (por exemplo Railway com imagem construída a partir deste ficheiro), o comando de arranque inclui `npx prisma migrate deploy` **antes** de `node dist/server.js`. Ou seja: cada **novo deploy** que subir um contentor com esse `CMD` aplica as migrações pendentes. Isso costuma estar ligado ao push só **indirectamente** (push → CI build → plataforma faz deploy → contentor inicia).

**O `npm start` actual** em `backend/package.json` é só `node dist/server.js` — **não** inclui `migrate deploy`. Para migrações manuais ou servidores sem Docker, use `npx prisma migrate deploy` com `DATABASE_URL` correcto.

O workflow **GitHub Actions** (`.github/workflows/ci.yml`) só corre `npm run build`; **não** aplica migrações na sua base de produção.

A primeira vez precisa da base vazia ou compatível com as migrações em `backend/prisma/migrations`.

### E-mail transaccional (nível profissional, baixo custo)

A API envia e-mail via **Resend** (HTTP, recomendado em produção) ou **SMTP** (Brevo, Gmail app password, etc.). Quando `RESEND_API_KEY` está definido, ela tem prioridade sobre SMTP.

| Variável | Descrição |
|----------|-----------|
| `RESEND_API_KEY` | Chave da API em [resend.com](https://resend.com) — plano gratuito sufficient para começar. |
| `RESEND_FROM_EMAIL` | Endereço remetente **verificado** no Resend (ou `onboarding@resend.dev` para testes). |
| `SMTP_*` | Alternativa clássica; ver `backend/.env.example`. |
| `ENABLE_EMAIL_QUEUE_PROCESSOR` | Por defeito activo: a API processa a fila `EmailOutbox` na base de dados a cada ~45s. Defina `false` e use cron com `cd backend && npm run email-queue-once` se preferir um único worker. |

Fluxos suportados na base de código: **recuperação de senha** (imediato), **confirmação de encomenda** após checkout (fila + retries). Novos tipos de e-mail devem usar `emailOutboxService.enqueueTransactionalEmail` com `dedupeKey` estável para idempotência.

---

## Vercel — frontend (Vite)

### Projeto

1. **Import Project** → mesmo repo GitHub.
2. **Root Directory** = `frontend`.
3. Framework: **Vite** (ou “Other” com build abaixo).

### Build

- **Build command:** `npm run build`
- **Output directory:** `dist`

`frontend/vercel.json` já define rewrites SPA para `index.html`.

### Variável de ambiente

| Variável | Produção |
|----------|----------|
| `VITE_API_BASE` | URL completa da API **com** sufixo `/api/v1`, ex. `https://api.bazardobie.com/api/v1` |

Valor incorreto aqui quebra login, uploads e todas as chamadas REST.

### Domínio na Vercel

Em **Project → Settings → Domains**, adiciona `bazardobie.com` e, se quiseres, `www.bazardobie.com`; configura redireccionamento entre apex e `www` para ficar um só URL oficial (o mesmo que `FRONTEND_URL` na Railway).

### Desenvolvimento local

Com o proxy do Vite para o backend, podes usar `VITE_API_BASE=/api/v1` em `.env.local`. Em produção na Vercel **não** uses caminho relativo; usa sempre o URL público da API (`https://api.bazardobie.com/api/v1`).

---

## Ordem recomendada

1. Subir Postgres + API na Railway; liga o domínio `api.bazardobie.com` e define `PUBLIC_BASE_URL=https://api.bazardobie.com`.
2. Deploy do frontend na Vercel; liga `bazardobie.com` (e opcionalmente `www`), define `VITE_API_BASE=https://api.bazardobie.com/api/v1`.
3. Na Railway, define `FRONTEND_URL` para o URL canónico do site (ex. `https://bazardobie.com`).

---

## Verificação local antes do push

```bash
cd backend && npm ci && npm run build
cd ../frontend && npm ci && npm run build
```
