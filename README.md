# Geniusness – Puzzle League

A web app for tracking daily puzzle game scores in leagues. Create or join a league, choose games (Wordle, Connections, etc.), set a duration (or leave it indefinite), invite others via a code, and track stats over time.

## Stack

- **Frontend:** Vue 3, Vue Router, Pinia, Vite, Axios
- **Backend:** Express, Supabase (PostgreSQL + Auth)

## Quick start

1. **Backend (Supabase)**  
   See **[BACKEND_SETUP.md](./BACKEND_SETUP.md)** for creating a Supabase project, running the schema (`supabase/schema.sql`), and configuring `server/.env` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

2. **Install and run**
   ```bash
   npm install
   npm install --prefix client
   npm run dev
   ```
   This starts the Vite dev server (e.g. http://localhost:5173) and the Express API (e.g. http://localhost:3000). The app proxies `/api` to the backend.

3. **Use the app**
   - Sign up → Log in
   - Create a league (name, duration, games), or join with an invite code
   - View a league: invite code, players, add scores, standings, recent scores
   - **My stats:** filter by league/game/date range to see your scores over time

## Features

- **Leagues:** Create with name, start/end dates (or indefinite), and selected games
- **Invites:** Each league has an invite code; others join via “Join league”
- **Scores:** One score per user per league per game per date; lower or higher is better by game
- **Standings:** Per-game averages, sorted by score type
- **Stats:** Your scores over time, filterable by league, game, and date range
- **Auth:** Sign up / log in via Supabase; session persisted in `localStorage`

## Deploying

- **Frontend:** `npm run build --prefix client` → deploy `client/dist` (e.g. Vercel, Netlify). Point API requests to your deployed backend URL.
- **Backend:** Deploy the `server` folder (e.g. Railway, Render, Fly.io). Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `PORT` in the host’s environment.

Keep Supabase config the same in prod; only the deployed API URL changes for the frontend.
