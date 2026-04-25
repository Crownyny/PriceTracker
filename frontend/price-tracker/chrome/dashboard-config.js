(function initDashboardConfig(global) {
  const PriceTracker = (global.PriceTracker = global.PriceTracker || {});

  const DEFAULT_DASHBOARD_URL = 'http://localhost:4200/dashboard';
  const STORAGE_KEY = 'dashboardUrl';
  const AUTH_TOKEN_KEY = 'firebaseAuthToken';
  const LOGIN_PATH = '/login';

  async function loadDashboardUrl() {
    try {
      const result = await chrome.storage.sync.get([STORAGE_KEY]);
      const dashboardUrl = result[STORAGE_KEY] || DEFAULT_DASHBOARD_URL;
      PriceTracker.dashboardUrl = dashboardUrl;
      return dashboardUrl;
    } catch (error) {
      console.warn('[DASHBOARD CONFIG] No se pudo leer dashboardUrl, usando default', error);
      PriceTracker.dashboardUrl = DEFAULT_DASHBOARD_URL;
      return DEFAULT_DASHBOARD_URL;
    }
  }

  async function getDashboardUrl() {
    if (PriceTracker.dashboardUrl) {
      return PriceTracker.dashboardUrl;
    }

    return loadDashboardUrl();
  }

  async function saveDashboardUrl(dashboardUrl) {
    try {
      await chrome.storage.sync.set({ [STORAGE_KEY]: dashboardUrl });
      PriceTracker.dashboardUrl = dashboardUrl;
      return true;
    } catch (error) {
      console.error('[DASHBOARD CONFIG] No se pudo guardar dashboardUrl', error);
      return false;
    }
  }

  function buildLoginUrl(dashboardUrl) {
    const url = new URL(dashboardUrl);
    const dashboardPath = url.pathname.replace(/\/$/, '');

    if (dashboardPath.endsWith('/dashboard')) {
      url.pathname = dashboardPath.slice(0, -'/dashboard'.length) + LOGIN_PATH;
      return url.toString();
    }

    url.pathname = LOGIN_PATH;
    return url.toString();
  }

  async function getDashboardEntryUrl() {
    const dashboardUrl = await getDashboardUrl();
    const authState = await chrome.storage.local.get([AUTH_TOKEN_KEY]);

    if (authState[AUTH_TOKEN_KEY]) {
      return dashboardUrl;
    }

    return buildLoginUrl(dashboardUrl);
  }

  PriceTracker.dashboardConfigManager = {
    loadDashboardUrl,
    getDashboardUrl,
    getDashboardEntryUrl,
    saveDashboardUrl
  };

  PriceTracker.dashboardUrl = DEFAULT_DASHBOARD_URL;
})(window);
