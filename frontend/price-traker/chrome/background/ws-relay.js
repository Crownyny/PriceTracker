// WebSocket relay for background service worker
(function initWSRelay(global) {
  console.log('[WS RELAY] Iniciando módulo de relay...');
  
  const wsRelayService = {
    stompClient: null,
    messageHandlers: {},
    
    initialize: function(config) {
      console.log('[WS RELAY] Inicializando con config:', config);
      
      if (typeof StompJs === 'undefined') {
        console.error('[WS RELAY] ERROR: StompJS no disponible. Verificar importScripts.');
        return;
      }
      
      // Use the correct WebSocket factory through a native WebSocket
      this.createStompClient(config);
    },
    
    createStompClient: function(config) {
      if (typeof StompJs === 'undefined') {
        console.error('[WS RELAY] ERROR: StompJS no cargado en background');
        this.broadcastToAllTabs('error', { error: 'StompJS not available' });
        return;
      }
      
      const baseUrl = config.wsBaseUrl || 'ws://localhost:8080';
      console.log('[WS RELAY] Base URL:', baseUrl);
      console.log('[WS RELAY] Endpoint:', config.wsEndpoint);
      
      try {
        // Use SockJS transport since backend is configured with .withSockJS()
        // SockJS needs HTTP/HTTPS URL, convert ws/wss to http/https
        const sockjsUrl = baseUrl
          .replace('wss://', 'https://')
          .replace('ws://', 'http://') + (config.wsEndpoint || '/ws');
        
        console.log('[WS RELAY] SockJS URL:', sockjsUrl);
        
        this.stompClient = new StompJs.Client({
          webSocketFactory: () => {
            console.log('[WS RELAY] Creando SockJS connection...');
            // SockJS expects HTTP/HTTPS URL and handles the upgrade internally
            if (typeof SockJS === 'undefined') {
              throw new Error('SockJS not available');
            }
            return new SockJS(sockjsUrl);
          },
          connectHeaders: config.headers || {},
          reconnectDelay: 5000,
          heartbeatIncoming: 10000,
          heartbeatOutgoing: 10000,
          debug: (msg) => {
            if (msg && msg.length > 0) {
              console.log('[WS RELAY STOMP]', msg);
            }
          },
        });
        
        this.stompClient.onConnect = () => {
          console.log('[WS RELAY] ✅ STOMP CONECTADO al servidor');
          this.broadcastToAllTabs('connected', { status: 'connected' });
          this.subscribeToQueues();
        };
        
        this.stompClient.onDisconnect = () => {
          console.log('[WS RELAY] STOMP desconectado');
          this.broadcastToAllTabs('disconnected', { status: 'disconnected' });
        };
        
        this.stompClient.onStompError = (frame) => {
          console.error('[WS RELAY] STOMP Error:', frame.headers.message);
          this.broadcastToAllTabs('error', { error: frame.headers.message });
        };
        
        this.stompClient.onWebSocketError = (event) => {
          console.error('[WS RELAY] WebSocket Error:', event);
          this.broadcastToAllTabs('error', { error: 'WebSocket connection failed' });
        };
        
        this.stompClient.onWebSocketClose = () => {
          console.log('[WS RELAY] WebSocket cerrado');
        };
        
        console.log('[WS RELAY] Activando cliente STOMP...');
        this.stompClient.activate();
        
      } catch (error) {
        console.error('[WS RELAY] ERROR creando StompClient:', error);
        this.broadcastToAllTabs('error', { error: error.message });
      }
    },
    
    subscribeToQueues: function() {
      if (!this.stompClient || !this.stompClient.connected) {
        console.warn('[WS RELAY] No se puede suscribir: cliente no conectado');
        return;
      }
      
      try {
        console.log('[WS RELAY] Suscribiéndose a colas...');
        
        // Subscribe to products queue
        this.stompClient.subscribe('/user/queue/products', (message) => {
          try {
            const payload = JSON.parse(message.body);
            console.log('[WS RELAY] Producto recibido:', payload);
            this.broadcastToAllTabs('product-received', payload);
          } catch (e) {
            console.error('[WS RELAY] Error parseando producto:', e);
          }
        });
        
        // Subscribe to errors queue
        this.stompClient.subscribe('/user/queue/errors', (message) => {
          try {
            console.log('[WS RELAY] Raw error message received:', message.body);
            const payload = JSON.parse(message.body);
            console.log('[WS RELAY] ❌ ERROR RECIBIDO DEL BACKEND:', payload);
            this.broadcastToAllTabs('error-received', payload);
          } catch (e) {
            console.error('[WS RELAY] Error parseando error message:', e, message.body);
          }
        });
        
        // Subscribe to status queue
        this.stompClient.subscribe('/user/queue/status', (message) => {
          try {
            const payload = JSON.parse(message.body);
            console.log('[WS RELAY] Estado recibido:', payload);
            this.broadcastToAllTabs('status-received', payload);
          } catch (e) {
            console.error('[WS RELAY] Error parseando status:', e);
          }
        });
        
        console.log('[WS RELAY] ✅ Subscripciones completadas');
        
        // Small delay to ensure backend has processed subscriptions
        setTimeout(() => {
          console.log('[WS RELAY] Subscriptions delay complete - ready for searches');
        }, 100);
      } catch (error) {
        console.error('[WS RELAY] Error suscribiéndose:', error);
      }
    },
    
    sendSearch: function(payload) {
      if (!this.stompClient || !this.stompClient.connected) {
        console.error('[WS RELAY] ERROR: No conectado. stompClient:', this.stompClient?.connected);
        throw new Error('WebSocket no conectado');
      }
      
      try {
        this.stompClient.publish({
          destination: '/app/search',
          body: JSON.stringify(payload),
        });
        console.log('[WS RELAY] ✅ Búsqueda enviada:', payload);
      } catch (error) {
        console.error('[WS RELAY] Error enviando búsqueda:', error);
        throw error;
      }
    },
    
    broadcastToAllTabs: function(eventType, data) {
      console.log(`[WS RELAY] Broadcasting ${eventType} a todas las pestañas:`, data);
      
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          try {
            chrome.tabs.sendMessage(tab.id, {
              type: 'ws-relay-' + eventType,
              data: data,
            }).catch((err) => {
              // Tab might not be responsive, ignore
            });
          } catch (e) {
            // Silently ignore
          }
        });
      });
    },
    
    disconnect: function() {
      console.log('[WS RELAY] Desconectando...');
      if (this.stompClient) {
        this.stompClient.deactivate();
      }
    },

    fetchCachedProducts: async function(productRef) {
      // Make REST call from background (no CORS issues)
      try {
        const apiUrl = 'http://localhost:8080/api/products/search';
        console.log('[WS RELAY] Fetching cached products:', productRef);
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_ref: productRef }),
        });

        if (!response.ok) {
          console.error('[WS RELAY] Error fetching cached products:', response.statusText);
          this.broadcastToAllTabs('fetch-error', { error: response.statusText, productRef });
          return;
        }

        const cachedProducts = await response.json();
        if (!Array.isArray(cachedProducts)) {
          console.warn('[WS RELAY] Expected array, got:', cachedProducts);
          return;
        }

        console.log(`[WS RELAY] ✓ Fetched ${cachedProducts.length} cached products`);
        
        // Broadcast each product as if it came from WebSocket
        for (const product of cachedProducts) {
          this.broadcastToAllTabs('product-received', product);
        }
        
        // Send completion marker
        this.broadcastToAllTabs('cached-products-loaded', { count: cachedProducts.length });
      } catch (error) {
        console.error('[WS RELAY] Error in fetchCachedProducts:', error);
        this.broadcastToAllTabs('fetch-error', { error: error.message, productRef });
      }
    },

    restoreByProductRef: async function(productRef, query) {
      // Make REST call from background (no CORS issues)
      try {
        const apiUrl = 'http://localhost:8080/api/products/search';
        console.log('[WS RELAY] REST: Fetching products for productRef:', productRef);
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_ref: productRef }),
        });

        if (!response.ok) {
          console.error('[WS RELAY] REST Error:', response.status, response.statusText);
          this.broadcastToAllTabs('rest-search-error', { status: response.status });
          return;
        }

        const products = await response.json();
        console.log(`[WS RELAY] ✓ REST returned ${Array.isArray(products) ? products.length : '?'} products`);
        
        // Send all products in a single message
        this.broadcastToAllTabs('rest-search-complete', { 
          count: Array.isArray(products) ? products.length : 0,
          products: Array.isArray(products) ? products : []
        });
      } catch (error) {
        console.error('[WS RELAY] REST Error:', error.message);
        this.broadcastToAllTabs('rest-search-error', { error: error.message });
      }
    },

    checkIfProductExists: async function(productRef) {
      // Quick check if product exists in backend
      try {
        const apiUrl = 'http://localhost:8080/api/products/search';
        console.log('[WS RELAY] CHECK: Checking if product exists:', productRef);
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_ref: productRef }),
        });

        if (!response.ok) {
          console.log('[WS RELAY] CHECK: API error ' + response.status + ' - product does not exist');
          this.broadcastToAllTabs('check-product-response', { 
            exists: false,
            productRef: productRef
          });
          return;
        }

        const products = await response.json();
        const exists = Array.isArray(products) && products.length > 0;
        console.log(`[WS RELAY] CHECK: Product ${exists ? 'EXISTS' : 'NOT FOUND'} (${Array.isArray(products) ? products.length : 0} items)`);
        
        this.broadcastToAllTabs('check-product-response', { 
          exists: exists,
          productRef: productRef,
          count: Array.isArray(products) ? products.length : 0
        });
      } catch (error) {
        console.error('[WS RELAY] CHECK Error:', error.message);
        this.broadcastToAllTabs('check-product-response', { 
          exists: false,
          productRef: productRef,
          error: error.message
        });
      }
    }
  };
  
  // Listen for messages from content scripts
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[WS RELAY] Mensaje recibido:', message.type);
    
    try {
      if (message.type === 'ws-relay-init') {
        wsRelayService.initialize(message.config);
        sendResponse({ success: true });
      } else if (message.type === 'ws-relay-send-search') {
        wsRelayService.sendSearch(message.payload);
        sendResponse({ success: true });
      } else if (message.type === 'ws-relay-fetch-cached') {
        // Handle cached product fetch asynchronously
        wsRelayService.fetchCachedProducts(message.productRef);
        sendResponse({ success: true });
      } else if (message.type === 'ws-relay-rest-search') {
        // Handle REST search asynchronously
        wsRelayService.restoreByProductRef(message.productRef, message.query);
        sendResponse({ success: true });
      } else if (message.type === 'ws-relay-check-product') {
        // Handle product existence check
        wsRelayService.checkIfProductExists(message.productRef);
        sendResponse({ success: true });
      } else if (message.type === 'ws-relay-disconnect') {
        wsRelayService.disconnect();
        sendResponse({ success: true });
      }
    } catch (error) {
      console.error('[WS RELAY] Error procesando mensaje:', error);
      sendResponse({ success: false, error: error.message });
    }
  });
  
  console.log('[WS RELAY] ✅ Módulo de relay cargado y listo');
})(self);
