(function initConstants(global) {
  const PriceTracker = (global.PriceTracker = global.PriceTracker || {});

  PriceTracker.constants = {
    LOG_PREFIX: '[PRICE TRACKER]',
    STORAGE_KEYS: {
      EXTENSION_ACTIVE: 'extensionActive',
    },
    MESSAGE_TYPES: {
      TOGGLE_EXTENSION: 'TOGGLE_EXTENSION',
      EXTENSION_STATE_CHANGED: 'EXTENSION_STATE_CHANGED',
      OPEN_DASHBOARD: 'OPEN_DASHBOARD',
      SHOW_PRICE_OVERLAY: 'SHOW_PRICE_OVERLAY',
    },
    REFRESH: {
      CACHE_TTL_MS: 60 * 1000,
      POLL_INTERVAL_MS: 45 * 1000,
    },
    SEARCH: {
      TIMEOUT_MS: 90 * 1000,
      DEFAULT_SOURCES: 'amazon,mercadolibre,walmart',
    },
    API: {
      USE_MOCK: false,
      BASE_URL: 'http://localhost:8080',
      REST_SEARCH_PATH: '/api/products/search',
      REST_FALLBACK_ENABLED: true,
    },
    WS: {
      BASE_URL: 'http://localhost:8080',
      ENDPOINT: '/ws',
      SEARCH_DESTINATION: '/app/search',
      USER_PRODUCTS_QUEUE: '/user/queue/products',
      USER_ERRORS_QUEUE: '/user/queue/errors',
      RECONNECT_BASE_MS: 1000,
      RECONNECT_MAX_MS: 30000,
      AUTH_TOKEN: '',
      DEBUG: false,
    },
  };
})(window);
