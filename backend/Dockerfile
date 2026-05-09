# Build na raiz do serviço Railway (defina Root Directory = backend)
FROM node:20-bookworm-slim AS runner

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

# prisma generate exige que DATABASE_URL esteja definida (validação do schema); não liga à BD.
# Migrações correm no CMD com o DATABASE_URL real injectado pelo Railway.
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/prisma_generate_only"

RUN npm run build

ENV NODE_ENV=production
# Railway injecta PORT; uploads locais são efémeros sem volume persistente
ENV UPLOAD_DIR=/app/uploads

EXPOSE 8080

CMD ["sh", "-c", "mkdir -p \"$UPLOAD_DIR\" && npx prisma migrate deploy && npx prisma db seed && node dist/server.js"]
