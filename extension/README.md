# Geniusness Browser Extension

Capture puzzle scores from **NYT Games** (Wordle, Connections, Strands, etc.) and send them to your Geniusness league with one click—no more copying and pasting share text.

---

## Get it working locally (step-by-step)

Do these in order. You need the app and API running on your machine first.

1. **Start the app and API**
   - From the project root: `npm run dev`
   - That starts the Vite app at **http://localhost:5173** and the API at **http://localhost:3000**.

2. **Load the extension in Chrome or Edge**
   - Open **chrome://extensions** (or **edge://extensions**).
   - Turn **Developer mode** on (top right).
   - Click **Load unpacked** and choose the **`extension`** folder inside this repo (the folder that contains `manifest.json`).
   - The extension icon should appear in the toolbar.

3. **Configure the extension**
   - Click the extension icon → popup opens.
   - **API base URL:** `http://localhost:3000`
   - **App origin:** `http://localhost:5173`
   - Click **Save**.

4. **Connect your account**
   - In a normal tab, open **http://localhost:5173** and log in.
   - In the sidebar, click **Connect extension** (or go to **http://localhost:5173/#extension-connect**).
   - Click **Send credentials to extension**.
   - You should see **Connected ✓**. (If the extension popup was open, click it again to see “Connected (user linked)”.)

5. **Use it on NYT Games**
   - Open e.g. **https://www.nytimes.com/games/wordle** (or Connections, etc.).
   - Finish a puzzle (or use one you’ve already done).
   - In the game, click **Share** so the results are copied.
   - You should see a **Send to Geniusness** button at the bottom-right of the page. Click it.
   - The extension sends your score to your local API; it should show up on your Home page for today.

If **Send to Geniusness** doesn’t appear, make sure you’re on a supported NYT game URL (e.g. `nytimes.com/games/wordle`). If the button says something went wrong, check that the API is running at http://localhost:3000 and that you completed step 4.

---

## How it works

1. **Install** the extension and open its popup.
2. **Set your API URL** (e.g. `http://localhost:3000` or your production backend).
3. **Connect your account**: open your Geniusness app, log in, go to **Connect extension** (sidebar), then click **Send credentials to extension**.
4. On **NYT Games** (e.g. [Wordle](https://www.nytimes.com/games/wordle), [Connections](https://www.nytimes.com/games/connections)), after you finish a puzzle:
   - Click **Share** on the game (so the share text is copied).
   - Click the **Send to Geniusness** button (injected at the bottom-right).
   - The extension parses the share text and submits your score to your Geniusness backend.

If the extension can’t read the clipboard, it will ask you to paste the share text.

## Load the extension (Chrome / Edge)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked**.
4. Select the **`extension`** folder inside this repo.

After loading, the extension icon appears in the toolbar. Click it to set the API URL and App origin.

## Popup settings

- **API base URL**: Your Geniusness backend (e.g. `http://localhost:3000`). No trailing slash.
- **App origin**: Where your Geniusness web app is hosted (e.g. `http://localhost:5173`). Used when you click “Open app & connect” so the extension can receive your credentials from the app.

## Supported games

The extension injects **Send to Geniusness** on these sites:

**NYT (nytimes.com):** Wordle, Connections, Strands, Spelling Bee, Letter Boxed, Vertex, Sudoku, Mini Crossword, Crossword, Tiles  

**Other publishers:**
- **Bracket City** — [theatlantic.com/games/bracket-city](https://www.theatlantic.com/games/bracket-city/)
- **Pyramid Scheme** — [buzzfeed.com/pyramid-scheme](https://www.buzzfeed.com/pyramid-scheme)
- **Keyword** — [washingtonpost.com/games/keyword](https://www.washingtonpost.com/games/keyword/)
- **Quintumble** — [quintumble.com](https://quintumble.com/#)

Score submission only works for games that your backend supports (via `game_share_parsers` and `/api/share-parser/parse`). Wordle and Connections are supported by default; Pyramid Scheme, Quintumble, and Bracket City have parsers in `migration_add_new_games.sql` if you’ve run that migration.

## Development

- Edit files in the `extension` folder.
- After changes, go to `chrome://extensions` and click the **Reload** icon on the Geniusness extension.
- The extension uses the same **parse** and **daily** score APIs as the web app paste flow.

## Security

- Credentials (user ID and optional token) are stored in the extension’s sync storage and only sent to your configured API base URL.
- The “Connect” flow sends credentials via `postMessage` from the Geniusness app tab to the extension; the extension only saves them when the user explicitly clicks **Send credentials to extension** on your app.
