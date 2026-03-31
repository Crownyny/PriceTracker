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
            const payload = JSON.parse(message.body);
            console.log('[WS RELAY] Error recibido:', payload);
            this.broadcastToAllTabs('error-received', payload);
          } catch (e) {
            console.error('[WS RELAY] Error parseando error:', e);
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
