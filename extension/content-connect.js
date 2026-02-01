// Geniusness – content script to receive "Connect" from the Geniusness web app
// Listens for postMessage from the app and forwards credentials to the background.

window.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'GENIUSNESS_EXTENSION_CONNECT') {
    const { apiBaseUrl, appOrigin, userId, accessToken } = event.data.payload || {};
    chrome.runtime.sendMessage(
      {
        type: 'GENIUSNESS_SAVE_CONNECT',
        payload: {
          apiBaseUrl: apiBaseUrl || event.data.apiBaseUrl,
          appOrigin: appOrigin || event.data.appOrigin || event.origin,
          userId: userId || event.data.userId,
          accessToken: accessToken != null ? accessToken : event.data.accessToken,
        },
      },
      function (response) {
        if (event.source && event.source.postMessage) {
          event.source.postMessage(
            { type: 'GENIUSNESS_EXTENSION_CONNECT_RESPONSE', ok: response && response.ok, error: response && response.error },
            event.origin
          );
        }
      }
    );
  }
});
