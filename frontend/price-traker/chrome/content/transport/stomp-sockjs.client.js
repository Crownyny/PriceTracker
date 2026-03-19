(function initStompSockJsClient(global) {
  const PriceTracker = (global.PriceTracker = global.PriceTracker || {});
  const { constants } = PriceTracker;

  function createClient() {
    let stompClient = null;
    let connected = false;
    let subscriptions = [];
    let shouldReconnect = true;
    let reconnectAttempt = 0;
    let reconnectTimer = null;
    let handlers = {
      onConnect: () => {},
      onDisconnect: () => {},
      onProducts: () => {},
      onErrors: () => {},
      onTransportError: () => {},
    };

    function configure(nextHandlers) {
      handlers = { ...handlers, ...(nextHandlers || {}) };
    }

    function connect(headers) {
      shouldReconnect = true;
      if (connected) {
        return;
      }
      initClient(headers || {});
      stompClient.activate();
    }

    function disconnect() {
      shouldReconnect = false;
      clearReconnectTimer();
      if (stompClient) {
        try {
          stompClient.deactivate();
        } catch (error) {
          console.error(`${constants.LOG_PREFIX} Error desconectando STOMP:`, error);
        }
      }
      connected = false;
      subscriptions = [];
    }

    function sendSearch(payload) {
      if (!connected || !stompClient) {
        throw new Error('Cliente STOMP no conectado');
      }

      stompClient.publish({
        destination: constants.WS.SEARCH_DESTINATION,
        body: JSON.stringify(payload),
      });
    }

    function initClient(headers) {
      stompClient = new global.StompJs.Client({
        webSocketFactory: () => new global.SockJS(`${constants.WS.BASE_URL}${constants.WS.ENDPOINT}`),
        connectHeaders: headers,
        reconnectDelay: 0,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        debug: constants.WS.DEBUG ? (msg) => console.debug(`${constants.LOG_PREFIX} STOMP ${msg}`) : () => {},
      });

      stompClient.onConnect = () => {
        connected = true;
        reconnectAttempt = 0;
        subscribeQueues();
        handlers.onConnect();
      };

      stompClient.onStompError = (frame) => {
        handlers.onTransportError(new Error(frame.headers.message || 'Stomp error'));
      };

      stompClient.onWebSocketClose = () => {
        const wasConnected = connected;
        connected = false;
        subscriptions = [];
        if (wasConnected) {
          handlers.onDisconnect();
        }
        if (shouldReconnect) {
          scheduleReconnect(headers);
        }
      };

      stompClient.onWebSocketError = (event) => {
        handlers.onTransportError(new Error(`WebSocket error: ${event.type}`));
      };
    }

    function subscribeQueues() {
      if (!stompClient || !connected) {
        return;
      }

      subscriptions.push(
        stompClient.subscribe(constants.WS.USER_PRODUCTS_QUEUE, (frame) => {
          const payload = safeJsonParse(frame.body);
          if (payload) {
            handlers.onProducts(payload);
          }
        })
      );

      subscriptions.push(
        stompClient.subscribe(constants.WS.USER_ERRORS_QUEUE, (frame) => {
          const payload = safeJsonParse(frame.body);
          if (payload) {
            handlers.onErrors(payload);
          }
        })
      );
    }

    function scheduleReconnect(headers) {
      clearReconnectTimer();
      reconnectAttempt += 1;
      const backoff = Math.min(constants.WS.RECONNECT_BASE_MS * (2 ** (reconnectAttempt - 1)), constants.WS.RECONNECT_MAX_MS);
      reconnectTimer = global.setTimeout(() => {
        if (!shouldReconnect) {
          return;
        }
        initClient(headers);
        stompClient.activate();
      }, backoff);
    }

    function clearReconnectTimer() {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    }

    function safeJsonParse(raw) {
      try {
        return JSON.parse(raw);
      } catch (error) {
        console.error(`${constants.LOG_PREFIX} JSON invalido en stream:`, error);
        return null;
      }
    }

    return {
      configure,
      connect,
      disconnect,
      sendSearch,
      isConnected: () => connected,
    };
  }

  PriceTracker.stompSockJsClientFactory = {
    createClient,
  };
})(window);
