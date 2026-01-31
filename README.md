# Pivota Aurora Chatbox (Frontend)

Mobile-first chat UI that connects to the Pivota Glow Agent (BFF), which proxies Aurora Decision System.

## Local dev

```bash
npm i
npm run dev
```

Default dev server: `http://localhost:8080`

## Environment variables

Set these in Vercel (or locally via `.env.local`):

```bash
# Glow Agent BFF (Railway)
VITE_API_BASE_URL=https://pivota-glow-agent-production.up.railway.app

# Optional (defaults to VITE_API_BASE_URL if unset)
VITE_UPLOAD_ENDPOINT=https://pivota-glow-agent-production.up.railway.app
```

## Deploy (Vercel)

- Import this repo into Vercel
- Add the env vars above
- Deploy
