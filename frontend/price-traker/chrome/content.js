// Content script entrypoint
(function bootstrapContentScript(global) {
  const PriceTracker = (global.PriceTracker = global.PriceTracker || {});
  const { constants, state, monitorController } = PriceTracker;

  console.log(`${constants.LOG_PREFIX} Content Script cargado`);
  console.log(`${constants.LOG_PREFIX} URL actual:`, window.location.href);

  /**
   * Valida que estemos en la pestaña "Todo" (All) de Google Search
   * Retorna false si estamos en Imágenes, Videos, Noticias, etc.
   */
  function isGoogleSearchAllTab() {
    try {
      const url = new URL(window.location.href);
      const tbmParam = url.searchParams.get('tbm');
      
      // Si no hay parámetro 'tbm' o está vacío, es la pestaña "Todo"
      if (!tbmParam) {
        return true;
      }
      
      // Si el parámetro 'tbm' coincide con los tipos restringidos, bloqueamos
      const isRestricted = constants.GOOGLE_SEARCH.RESTRICTED_TYPES.includes(tbmParam);
      
      if (isRestricted) {
        console.log(
          `${constants.LOG_PREFIX} Extensión deshabilitada: Tipo de búsqueda no permitido (tbm=${tbmParam}). Solo funciona en búsqueda "Todo"`
        );
        return false;
      }
      
      return true;
    } catch (error) {
      console.error(`${constants.LOG_PREFIX} Error validando tipo de búsqueda:`, error);
      return false;
    }
  }

  init();

  async function init() {
    try {
      // Validar que estemos en la pestaña "Todo" de Google Search
      if (!isGoogleSearchAllTab()) {
        console.log(`${constants.LOG_PREFIX} Extensión no inicializada: no está en la pestaña "Todo" de Google`);
        bindMessageHandlers(); // Igual configuramos handlers para posibles cambios futuros
        return;
      }

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
          if (!isGoogleSearchAllTab()) {
            console.log(`${constants.LOG_PREFIX} Cambio de estado ignorado: no está en la pestaña "Todo"`);
            sendResponse({ success: false, error: 'Extensión no soportada en este tipo de búsqueda' });
            break;
          }
          state.extensionActive = Boolean(message.active);
          if (state.extensionActive) {
            monitorController.start();
          } else {
            monitorController.stop();
          }
          sendResponse({ success: true });
          break;

        case constants.MESSAGE_TYPES.SHOW_PRICE_OVERLAY:
          if (!isGoogleSearchAllTab()) {
            console.log(`${constants.LOG_PREFIX} Overlay ignorado: no está en la pestaña "Todo"`);
            sendResponse({ success: false, error: 'Extensión no soportada en este tipo de búsqueda' });
            break;
          }
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
