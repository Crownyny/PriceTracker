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

    function configure(nextHandlers) {
      handlers = { ...handlers, ...(nextHandlers || {}) };
    }

    function connect(headers) {
      console.log(`${constants.LOG_PREFIX} [RELAY] Conectando al WebSocket a través del background...`);
      
      // Bind message listener only once
      if (!messageListenerBound) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
          handleBackgroundMessage(message);
        });
        messageListenerBound = true;
      }
      
      // Tell background service worker to initialize WebSocket
      chrome.runtime.sendMessage(
        {
          type: 'ws-relay-init',
          config: {
            wsBaseUrl: constants.WS.BASE_URL,
            wsEndpoint: constants.WS.ENDPOINT,
            headers: headers || {}
          }
        },
        (response) => {
          if (response && response.success) {
            console.log(`${constants.LOG_PREFIX} [RELAY] Background WebSocket inicializado`);
          } else {
            console.error(`${constants.LOG_PREFIX} [RELAY] Error inicializando background:`, response?.error);
            handlers.onTransportError(new Error('Failed to initialize background WebSocket'));
          }
        }
      );
    }

    function disconnect() {
      console.log(`${constants.LOG_PREFIX} [RELAY] Desconectando...`);
      chrome.runtime.sendMessage(
        { type: 'ws-relay-disconnect' },
        (response) => {
          connected = false;
          handlers.onDisconnect();
        }
      );
    }

    function sendSearch(payload) {
      if (!connected) {
        throw new Error('Cliente no conectado');
      }

      chrome.runtime.sendMessage(
        {
          type: 'ws-relay-send-search',
          payload: payload
        },
        (response) => {
          if (!response || !response.success) {
            console.error(`${constants.LOG_PREFIX} [RELAY] Error enviando búsqueda:`, response?.error);
            handlers.onTransportError(new Error(response?.error || 'Failed to send search'));
          }
        }
      );
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
          handlers.onConnect();
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
          console.log(`${constants.LOG_PREFIX} [RELAY] Error recibido:`, data);
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
