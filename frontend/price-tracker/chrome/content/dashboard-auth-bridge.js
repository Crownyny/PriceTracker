(function initDashboardAuthBridge() {
  const DASHBOARD_ORIGINS = new Set([
    'http://localhost:4200',
    'http://127.0.0.1:4200'
  ]);

  const STORAGE_TOKEN_KEY = 'firebaseAuthToken';
  const STORAGE_EMAIL_KEY = 'firebaseUserEmail';

  function isTrustedOrigin(origin) {
    return DASHBOARD_ORIGINS.has(origin);
  }

  function postToDashboard(payload) {
    window.postMessage(
      {
        source: 'pricetracker-extension',
        ...payload
      },
      window.location.origin
    );
  }

  async function publishCurrentState() {
    const data = await chrome.storage.local.get([STORAGE_TOKEN_KEY, STORAGE_EMAIL_KEY]);
    postToDashboard({
      type: 'AUTH_STATE',
      token: data[STORAGE_TOKEN_KEY] || null,
      email: data[STORAGE_EMAIL_KEY] || null
    });
  }

  window.addEventListener('message', async (event) => {
    if (event.source !== window) {
      return;
    }

    if (!isTrustedOrigin(event.origin)) {
      return;
    }

    const message = event.data;
    if (!message || message.source !== 'pricetracker-dashboard') {
      return;
    }

    if (message.type === 'AUTH_UPDATE') {
      const token = message.token || null;
      const email = message.email || null;

      if (token) {
        await chrome.storage.local.set({
          [STORAGE_TOKEN_KEY]: token,
          [STORAGE_EMAIL_KEY]: email
        });
      } else {
        await chrome.storage.local.remove([STORAGE_TOKEN_KEY, STORAGE_EMAIL_KEY]);
      }

      await publishCurrentState();
      return;
    }

    if (message.type === 'AUTH_LOGOUT') {
      await chrome.storage.local.remove([STORAGE_TOKEN_KEY, STORAGE_EMAIL_KEY]);
      await publishCurrentState();
      return;
    }

    if (message.type === 'AUTH_REQUEST_STATE') {
      await publishCurrentState();
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') {
      return;
    }

    if (changes[STORAGE_TOKEN_KEY] || changes[STORAGE_EMAIL_KEY]) {
      publishCurrentState().catch((err) => {
        console.warn('[PRICE TRACKER][AUTH BRIDGE] Failed to publish state', err);
      });
    }
  });

  publishCurrentState().catch(() => {
    // Non-blocking: bridge can continue listening even if first read fails.
  });
})();
