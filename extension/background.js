// Geniusness extension – background service worker
// Handles: fetching games list, parsing share text, submitting daily score

const STORAGE_KEYS = {
  API_BASE_URL: 'geniusness_api_base_url',
  APP_ORIGIN: 'geniusness_app_origin',
  USER_ID: 'geniusness_user_id',
  ACCESS_TOKEN: 'geniusness_access_token',
};

async function getStorage() {
  const result = await chrome.storage.sync.get([
    STORAGE_KEYS.API_BASE_URL,
    STORAGE_KEYS.APP_ORIGIN,
    STORAGE_KEYS.USER_ID,
    STORAGE_KEYS.ACCESS_TOKEN,
  ]);
  return {
    apiBaseUrl: (result[STORAGE_KEYS.API_BASE_URL] || '').replace(/\/$/, ''),
    appOrigin: (result[STORAGE_KEYS.APP_ORIGIN] || '').replace(/\/$/, ''),
    userId: result[STORAGE_KEYS.USER_ID] || null,
    accessToken: result[STORAGE_KEYS.ACCESS_TOKEN] || null,
  };
}

async function getGameIdBySlug(apiBaseUrl, slug) {
  const url = `${apiBaseUrl}/api/league/games`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch games list');
  const data = await res.json();
  const games = data.games || [];
  const game = games.find((g) => (g.slug || '').toLowerCase() === slug.toLowerCase());
  return game ? game.gameid : null;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GENIUSNESS_SUBMIT_SCORE') {
    const { shareText, gameSlug } = message.payload || {};
    (async () => {
      try {
        const { apiBaseUrl, userId } = await getStorage();
        if (!apiBaseUrl || !userId) {
          sendResponse({ ok: false, error: 'Extension not connected. Set API URL and connect from Geniusness.' });
          return;
        }
        if (!shareText || !gameSlug) {
          sendResponse({ ok: false, error: 'Missing share text or game.' });
          return;
        }
        const gameId = await getGameIdBySlug(apiBaseUrl, gameSlug);
        if (!gameId) {
          sendResponse({ ok: false, error: `Unknown game: ${gameSlug}` });
          return;
        }
        const parseRes = await fetch(`${apiBaseUrl}/api/share-parser/parse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId, shareText }),
        });
        const parseData = await parseRes.json();
        if (!parseRes.ok) {
          sendResponse({ ok: false, error: parseData.error || 'Could not parse score from share text.' });
          return;
        }
        const score = parseData.score;
        if (score == null || isNaN(score)) {
          sendResponse({ ok: false, error: 'Could not extract score from share text.' });
          return;
        }
        const dailyRes = await fetch(`${apiBaseUrl}/api/scores/daily`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            game_id: gameId,
            date: null,
            score,
          }),
        });
        const dailyData = await dailyRes.json();
        if (!dailyRes.ok) {
          sendResponse({ ok: false, error: dailyData.error || 'Failed to save score.' });
          return;
        }
        sendResponse({ ok: true, score });
      } catch (err) {
        sendResponse({ ok: false, error: err.message || 'Network or server error.' });
      }
    })();
    return true;
  }

  if (message.type === 'GENIUSNESS_SAVE_CONNECT') {
    const { apiBaseUrl, appOrigin, userId, accessToken } = message.payload || {};
    (async () => {
      try {
        const toSet = {};
        if (apiBaseUrl != null) toSet[STORAGE_KEYS.API_BASE_URL] = (apiBaseUrl || '').replace(/\/$/, '');
        if (appOrigin != null) toSet[STORAGE_KEYS.APP_ORIGIN] = (appOrigin || '').replace(/\/$/, '');
        if (userId != null) toSet[STORAGE_KEYS.USER_ID] = userId || null;
        if (accessToken != null) toSet[STORAGE_KEYS.ACCESS_TOKEN] = accessToken || null;
        await chrome.storage.sync.set(toSet);
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.type === 'GENIUSNESS_GET_STORAGE') {
    getStorage().then((s) => sendResponse(s));
    return true;
  }

  return false;
});
