# Backend setup (Supabase)

The app uses **Supabase** for auth and PostgreSQL. Follow these steps to get the backend running.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. **New project** → choose org, name (e.g. `geniusness`), database password, region.
3. Wait for the project to finish provisioning.

## 2. Run the database schema

1. In the Supabase dashboard, open **SQL Editor**.
2. Create a new query and paste the contents of `supabase/schema.sql`.
3. Run the query. This creates `users`, `games`, `league`, `league_game`, `league_player`, and `scores`, plus indexes and seed games.

## 3. Get your API keys

1. In the dashboard, go to **Project Settings** → **API**.
2. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** key (under "Project API keys") → `SUPABASE_SERVICE_ROLE_KEY`  
     Use this only on the server; never expose it in the client.

## 4. Configure the server

1. In the project root, ensure `server/.env` exists.
2. Add:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
PORT=3000
```

Replace with your actual Project URL and `service_role` key.

## 5. Run the app

From the project root:

```bash
npm install
npm run dev
```

This starts:

- **Client**: Vite dev server (e.g. `http://localhost:5173`)
- **Server**: Express API (e.g. `http://localhost:3000`)

The client proxies `/api` to the server via Vite, so both must be running.

## 6. Deploying later

- **Frontend**: Build with `npm run build --prefix client`; deploy the `client/dist` output to Vercel, Netlify, etc. Set the build’s API base URL to your deployed API.
- **Backend**: Deploy the `server` (e.g. Railway, Render, Fly.io). Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `PORT` in the host’s environment. Point the frontend’s API base URL to this backend URL.

Ensure the Supabase project **URL** and **keys** are the same in development and production; only the deployed API URL changes.
