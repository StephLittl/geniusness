const STORAGE_KEYS = {
  API_BASE_URL: 'geniusness_api_base_url',
  APP_ORIGIN: 'geniusness_app_origin',
  USER_ID: 'geniusness_user_id',
  ACCESS_TOKEN: 'geniusness_access_token',
};

document.addEventListener('DOMContentLoaded', async () => {
  const apiInput = document.getElementById('api-url');
  const appInput = document.getElementById('app-origin');
  const saveBtn = document.getElementById('save');
  const openAppBtn = document.getElementById('open-app');
  const statusEl = document.getElementById('status');

  const stored = await chrome.storage.sync.get([
    STORAGE_KEYS.API_BASE_URL,
    STORAGE_KEYS.APP_ORIGIN,
    STORAGE_KEYS.USER_ID,
    STORAGE_KEYS.ACCESS_TOKEN,
  ]);
  apiInput.value = (stored[STORAGE_KEYS.API_BASE_URL] || '').replace(/\/$/, '');
  appInput.value = (stored[STORAGE_KEYS.APP_ORIGIN] || '').replace(/\/$/, '');
  const userId = stored[STORAGE_KEYS.USER_ID];
  if (userId) {
    statusEl.textContent = 'Connected (user linked)';
    statusEl.className = 'status connected';
  } else {
    statusEl.textContent = 'Not connected – connect from the app';
    statusEl.className = 'status disconnected';
  }

  saveBtn.addEventListener('click', async () => {
    const apiBaseUrl = (apiInput.value || '').trim().replace(/\/$/, '');
    const appOrigin = (appInput.value || '').trim().replace(/\/$/, '');
    await chrome.storage.sync.set({
      [STORAGE_KEYS.API_BASE_URL]: apiBaseUrl || '',
      [STORAGE_KEYS.APP_ORIGIN]: appOrigin || '',
    });
    statusEl.textContent = apiBaseUrl ? 'Settings saved' : 'Settings cleared';
    statusEl.className = 'status ' + (userId ? 'connected' : 'disconnected');
  });

  openAppBtn.addEventListener('click', () => {
    const appOrigin = (appInput.value || '').trim().replace(/\/$/, '');
    const url = appOrigin ? `${appOrigin}/#extension-connect` : null;
    if (url) chrome.tabs.create({ url });
    else chrome.tabs.create({ url: 'https://www.nytimes.com/games/wordle' });
  });
});
