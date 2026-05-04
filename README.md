# Bazar do Bié

Monorepo com API em **Node/Express/Prisma** (`backend`) e interface **React/Vite** (`frontend`).

## Arranque local

- Backend: copia `backend/.env.example` para `backend/.env`, ajusta `DATABASE_URL` e corre `npm install` + `npm run dev` dentro de `backend` (usa o script definido em `package.json`).
- Frontend: em `frontend`, `npm install` + `npm run dev`; opcionalmente `frontend/.env.local` com `VITE_API_BASE=/api/v1` se usares proxy para a API.

## Deploy

Produção prevista: site em **bazardobie.com** (Vercel), API em **api.bazardobie.com** (Railway). Passo a passo: **[DEPLOY.md](./DEPLOY.md)**.
