# Deployment Guide

This guide covers deploying the Geniusness app to production.

## Overview

- **Frontend**: Vue 3 app (deploy to Vercel, Netlify, or similar)
- **Backend**: Express API (deploy to Railway, Render, Fly.io, or similar)
- **Database**: Supabase (already hosted, no deployment needed)

## Prerequisites

1. A Supabase project (already set up)
2. Accounts on deployment platforms:
   - Frontend: [Vercel](https://vercel.com) or [Netlify](https://netlify.com)
   - Backend: [Railway](https://railway.app), [Render](https://render.com), or [Fly.io](https://fly.io)

## Step 1: Configure Axios for Production

The app currently uses relative API paths (`/api/...`) which work in development with Vite's proxy. For production, we need to configure axios to use your backend URL.

**Option 1: Global Axios Configuration (Simplest)**

Update `client/src/main.js`:

```javascript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'
import axios from 'axios'

// Configure axios base URL for production
if (import.meta.env.PROD && import.meta.env.VITE_API_URL) {
  axios.defaults.baseURL = import.meta.env.VITE_API_URL
}

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.mount('#app')
```

This way, all existing `axios.get('/api/...')` calls will automatically use the base URL in production.

**Option 2: Use the axios config file (already created)**

The file `client/src/config/axios.js` has been created. You can update all files to use it:

1. Replace `import axios from 'axios'` with `import apiClient from '../config/axios'` (adjust path as needed)
2. Replace `axios.get/post` with `apiClient.get/post`

**Set Environment Variable:**

Create `.env.production` in the `client` folder (or set in your deployment platform):

```
VITE_API_URL=https://your-backend-url.com
```

**Note:** In development, leave `VITE_API_URL` unset or empty - Vite's proxy will handle routing.

## Step 2: Deploy the Backend

### Option A: Railway (Recommended)

1. **Install Railway CLI:**
   ```bash
   npm i -g @railway/cli
   railway login
   ```

2. **Initialize and deploy:**
   ```bash
   cd server
   railway init
   railway up
   ```

3. **Set environment variables in Railway dashboard:**
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
   - `PORT` - Railway will set this automatically

4. **Get your backend URL:**
   Railway will provide a URL like `https://your-app.railway.app`

### Option B: Render

1. **Create a new Web Service** on Render
2. **Connect your GitHub repository**
3. **Configure:**
   - **Root Directory**: `server`
   - **Build Command**: (leave empty, no build needed)
   - **Start Command**: `node server.js`
   - **Environment**: Node

4. **Set environment variables:**
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `PORT` (Render sets this automatically)

5. **Deploy** and get your backend URL

### Option C: Fly.io

1. **Install Fly CLI:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   fly auth login
   ```

2. **Initialize:**
   ```bash
   cd server
   fly launch
   ```

3. **Set secrets:**
   ```bash
   fly secrets set SUPABASE_URL=your-url
   fly secrets set SUPABASE_SERVICE_ROLE_KEY=your-key
   ```

4. **Deploy:**
   ```bash
   fly deploy
   ```

## Step 3: Deploy the Frontend

### Option A: Vercel (Recommended)

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Deploy:**
   ```bash
   cd client
   vercel
   ```

3. **Set environment variable:**
   - In Vercel dashboard → Project Settings → Environment Variables
   - Add `VITE_API_URL` = `https://your-backend-url.com` (from Step 2)

4. **Redeploy** after setting environment variables

### Option B: Netlify

1. **Install Netlify CLI:**
   ```bash
   npm i -g netlify-cli
   ```

2. **Create `netlify.toml` in project root:**
   ```toml
   [build]
     base = "client"
     publish = "client/dist"
     command = "npm run build"
   
   [build.environment]
     VITE_API_URL = "https://your-backend-url.com"
   ```

3. **Deploy:**
   ```bash
   cd client
   npm run build
   netlify deploy --prod --dir=dist
   ```

   Or connect to GitHub for automatic deployments.

## Step 4: Update CORS on Backend

Make sure your backend allows requests from your frontend domain. Update `server/server.js`:

```javascript
const corsOptions = {
  origin: process.env.FRONTEND_URL 
    ? process.env.FRONTEND_URL.split(',') 
    : ['http://localhost:5173'], // Default to dev
  credentials: true
}

app.use(cors(corsOptions));
```

Then set `FRONTEND_URL` environment variable in your backend deployment to your production frontend URL (e.g., `https://your-app.vercel.app`). You can include multiple URLs separated by commas if needed.

## Step 5: Test the Deployment

1. Visit your frontend URL
2. Try signing up/logging in
3. Verify API calls work (check browser console for errors)
4. Test creating a league and adding scores

## Troubleshooting

### CORS Errors
- Make sure your backend CORS configuration includes your frontend URL
- Check that environment variables are set correctly

### API Not Found (404)
- Verify `VITE_API_URL` is set correctly in frontend environment
- Check that backend is running and accessible
- Ensure API routes are correct (`/api/scores`, `/api/auth`, etc.)

### Environment Variables Not Working
- For Vite, variables must start with `VITE_`
- Rebuild/redeploy after changing environment variables
- Check that variables are set in the deployment platform's dashboard

## Quick Deploy Commands Summary

**Backend (Railway):**
```bash
cd server
railway init
railway up
# Set env vars in Railway dashboard
```

**Frontend (Vercel):**
```bash
cd client
vercel
# Set VITE_API_URL in Vercel dashboard
```

## Notes

- Keep your Supabase credentials secure (never commit to git)
- Use the same Supabase project for both dev and production
- Consider setting up a staging environment for testing
- Monitor your backend logs for errors
- Set up error tracking (e.g., Sentry) for production
