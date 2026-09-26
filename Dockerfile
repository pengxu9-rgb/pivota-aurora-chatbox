# syntax=docker/dockerfile:1
# aurora.pivota.cc — Vite SPA (static) + the gateway proxy rules Vercel did via rewrites.
FROM node:22-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# VITE_* are inlined into the bundle at BUILD time.
# Build-arg defaults ARE the production values (what the serving image was built with,
# read from its Cloud Build substitutions), so the deploy workflow, the PR build and a
# hand-run `gcloud builds submit` all build the same bundle.
ARG VITE_API_BASE_URL=https://gateway.pivota.cc
ARG VITE_PIVOTA_AGENT_URL=https://gateway.pivota.cc
ARG VITE_SHOP_GATEWAY_URL=https://gateway.pivota.cc
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL VITE_PIVOTA_AGENT_URL=$VITE_PIVOTA_AGENT_URL VITE_SHOP_GATEWAY_URL=$VITE_SHOP_GATEWAY_URL
RUN npm run build

FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
