// Content script entrypoint
(function bootstrapContentScript(global) {
  const PriceTracker = (global.PriceTracker = global.PriceTracker || {});
  const { constants, state, monitorController } = PriceTracker;

  console.log(`${constants.LOG_PREFIX} Content Script cargado`);
  console.log(`${constants.LOG_PREFIX} URL actual:`, window.location.href);

  init();

  async function init() {
    try {
      const result = await chrome.storage.local.get([constants.STORAGE_KEYS.EXTENSION_ACTIVE]);
      state.extensionActive = result[constants.STORAGE_KEYS.EXTENSION_ACTIVE] ?? false;

      console.log(
        `${constants.LOG_PREFIX} Estado inicial:`,
        state.extensionActive ? 'ACTIVADA' : 'DESACTIVADA'
      );

      if (state.extensionActive) {
        monitorController.start();
      }

      bindMessageHandlers();
      bindStorageSync();
    } catch (error) {
      console.error(`${constants.LOG_PREFIX} Error de inicializacion:`, error);
    }
  }

  function bindMessageHandlers() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case constants.MESSAGE_TYPES.EXTENSION_STATE_CHANGED:
          state.extensionActive = Boolean(message.active);
          if (state.extensionActive) {
            monitorController.start();
          } else {
            monitorController.stop();
          }
          sendResponse({ success: true });
          break;

        case constants.MESSAGE_TYPES.SHOW_PRICE_OVERLAY:
          if (message.data && message.data.query) {
            state.currentQuery = null;
            const nextUrl = `${window.location.origin}${window.location.pathname}?q=${encodeURIComponent(message.data.query)}`;
            history.replaceState({}, '', nextUrl);
            monitorController.processCurrentPage();
          }
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Tipo de mensaje desconocido' });
      }
    });
  }

  function bindStorageSync() {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local' || !changes[constants.STORAGE_KEYS.EXTENSION_ACTIVE]) {
        return;
      }

      const newState = Boolean(changes[constants.STORAGE_KEYS.EXTENSION_ACTIVE].newValue);
      if (newState === state.extensionActive) {
        return;
      }

      state.extensionActive = newState;
      if (newState) {
        monitorController.start();
      } else {
        monitorController.stop();
      }
    });
  }
})(window);
