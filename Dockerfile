# syntax=docker/dockerfile:1
FROM node:24.22.2-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9 AS runtime-base
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm install --global npm@11.13.0
FROM runtime-base AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY contracts/package.json contracts/package.json
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --fetch-retries=0 --fetch-timeout=30000
COPY backend backend
COPY frontend frontend
COPY contracts contracts
RUN npm run build && node --input-type=module -e "import argon2 from 'argon2'; await argon2.verify(await argon2.hash('native dependency smoke'), 'native dependency smoke')"
FROM runtime-base
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
CMD ["node","backend/dist/main.js"]
