// WebSocket client that relays through background service worker
(function initStompRelayClient(global) {
  const PriceTracker = (global.PriceTracker = global.PriceTracker || {});
  const { constants } = PriceTracker;

  function createClient() {
    let handlers = {
      onConnect: () => {},
      onDisconnect: () => {},
      onProducts: () => {},
      onErrors: () => {},
      onStatus: () => {},
      onTransportError: () => {},
    };

    let connected = false;
    let messageListenerBound = false;
    let connectionFallbackTimer = null;
    let connectionWatchdogTimer = null;

    function configure(nextHandlers) {
      handlers = { ...handlers, ...(nextHandlers || {}) };
    }

    function connect(headers) {
      console.log(`${constants.LOG_PREFIX} [RELAY] Conectando al WebSocket a través del background...`);

      if (connectionFallbackTimer) {
        clearTimeout(connectionFallbackTimer);
        connectionFallbackTimer = null;
      }
      if (connectionWatchdogTimer) {
        clearTimeout(connectionWatchdogTimer);
        connectionWatchdogTimer = null;
      }

      connectionWatchdogTimer = setTimeout(() => {
        if (!connected) {
          console.warn(`${constants.LOG_PREFIX} [RELAY] ws-relay-init no respondió a tiempo; continuando con modo resiliente`);
          connected = true;
          handlers.onConnect();
        }
      }, 2500);
      
      // Bind message listener only once
      if (!messageListenerBound) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
          if (message && message.type) {
            handleBackgroundMessage(message);
          }
        });
        messageListenerBound = true;
      }
      
      // Tell background service worker to initialize WebSocket
      try {
        chrome.runtime.sendMessage(
          {
            type: 'ws-relay-init',
            config: {
              wsBaseUrl: constants.WS.BASE_URL,
              wsEndpoint: constants.WS.ENDPOINT,
              apiBaseUrl: constants.API.BASE_URL,
              headers: headers || {}
            }
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error(`${constants.LOG_PREFIX} [RELAY] Chrome error:`, chrome.runtime.lastError.message);
              handlers.onTransportError(new Error(chrome.runtime.lastError.message));
              return;
            }
            if (response && response.success) {
              console.log(`${constants.LOG_PREFIX} [RELAY] Background inicializado`);
              if (connectionWatchdogTimer) {
                clearTimeout(connectionWatchdogTimer);
                connectionWatchdogTimer = null;
              }
              connectionFallbackTimer = setTimeout(() => {
                if (!connected) {
                  console.warn(`${constants.LOG_PREFIX} [RELAY] No llegó evento ws-relay-connected; continuando con fallback de init`);
                  connected = true;
                  handlers.onConnect();
                }
              }, 1500);
            } else {
              console.error(`${constants.LOG_PREFIX} [RELAY] Background error:`, response?.error);
              handlers.onTransportError(new Error(response?.error || 'Failed to initialize'));
            }
          }
        );
      } catch (error) {
        console.error(`${constants.LOG_PREFIX} [RELAY] Error enviando ws-relay-init:`, error.message);
        handlers.onTransportError(error);
      }
    }

    function disconnect() {
      console.log(`${constants.LOG_PREFIX} [RELAY] Desconectando...`);
      connected = false;
      if (connectionFallbackTimer) {
        clearTimeout(connectionFallbackTimer);
        connectionFallbackTimer = null;
      }
      if (connectionWatchdogTimer) {
        clearTimeout(connectionWatchdogTimer);
        connectionWatchdogTimer = null;
      }
      try {
        chrome.runtime.sendMessage(
          { type: 'ws-relay-disconnect' },
          (response) => {
            if (chrome.runtime.lastError) {
              console.warn(`${constants.LOG_PREFIX} [RELAY] Disconnect chrome error:`, chrome.runtime.lastError.message);
            }
            handlers.onDisconnect();
          }
        );
      } catch (error) {
        console.warn(`${constants.LOG_PREFIX} [RELAY] Disconnect exception:`, error.message);
        handlers.onDisconnect();
      }
    }

    function sendSearch(payload) {
      if (!connected) {
        throw new Error('Cliente no conectado');
      }

      try {
        chrome.runtime.sendMessage(
          {
            type: 'ws-relay-send-search',
            payload: payload
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error(`${constants.LOG_PREFIX} [RELAY] Chrome error:`, chrome.runtime.lastError.message);
              handlers.onTransportError(new Error(chrome.runtime.lastError.message));
              return;
            }
            if (!response || !response.success) {
              console.error(`${constants.LOG_PREFIX} [RELAY] Send error:`, response?.error);
              handlers.onTransportError(new Error(response?.error || 'Failed to send search'));
            }
          }
        );
      } catch (error) {
        console.error(`${constants.LOG_PREFIX} [RELAY] Exception sending search:`, error.message);
        throw error;
      }
    }

    function handleBackgroundMessage(message) {
      if (!message.type || !message.type.startsWith('ws-relay-')) {
        return;
      }

      const data = message.data;
      console.log(`${constants.LOG_PREFIX} [RELAY] Mensaje del background:`, message.type, data);
      
      switch (message.type) {
        case 'ws-relay-connected':
          console.log(`${constants.LOG_PREFIX} [RELAY] ✅ Conectado al servidor`);
          connected = true;
          if (connectionWatchdogTimer) {
            clearTimeout(connectionWatchdogTimer);
            connectionWatchdogTimer = null;
          }
          if (connectionFallbackTimer) {
            clearTimeout(connectionFallbackTimer);
            connectionFallbackTimer = null;
          }
          // Small delay to ensure subscriptions are processed
          setTimeout(() => {
            console.log(`${constants.LOG_PREFIX} [RELAY] Calling onConnect after subscription delay`);
            handlers.onConnect();
          }, 50);
          break;

        case 'ws-relay-disconnected':
          console.log(`${constants.LOG_PREFIX} [RELAY] Desconectado del servidor`);
          connected = false;
          handlers.onDisconnect();
          break;

        case 'ws-relay-product-received':
          console.log(`${constants.LOG_PREFIX} [RELAY] Producto recibido:`, data);
          handlers.onProducts(data);
          break;

        case 'ws-relay-error-received':
          console.log(`${constants.LOG_PREFIX} [RELAY] ❌ ERROR RECEIVED FROM BACKEND:`, data);
          handlers.onErrors(data);
          break;

        case 'ws-relay-status-received':
          console.log(`${constants.LOG_PREFIX} [RELAY] Estado recibido:`, data);
          handlers.onStatus(data);
          break;

        case 'ws-relay-error':
          console.error(`${constants.LOG_PREFIX} [RELAY] Error de transporte:`, data);
          handlers.onTransportError(new Error(data.error));
          break;
      }
    }

    return {
      configure,
      connect,
      disconnect,
      sendSearch,
      activate: connect // Alias for StompJS compatibility
    };
  }

  // Export factory
  PriceTracker.stompSockJsClientFactory = {
    createClient: createClient
  };

  console.log(`${constants.LOG_PREFIX} [RELAY] Cliente de relay STOMP cargado`);
})(window);
