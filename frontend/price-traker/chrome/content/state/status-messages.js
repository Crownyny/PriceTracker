// Status messages and state management for search workflow
(function initStatusMessages(global) {
  const PriceTracker = (global.PriceTracker = global.PriceTracker || {});

  const STATUS_MESSAGES = {
    // Connection states
    connecting: {
      message: 'Conectando al servidor...',
      icon: 'connecting',
      type: 'info',
    },
    connected: {
      message: 'Conectado',
      icon: 'check',
      type: 'success',
    },
    
    // Search states
    idle: {
      message: 'Listo para buscar',
      icon: 'search',
      type: 'info',
    },
    searching: {
      message: 'Enviando búsqueda...',
      icon: 'spinner',
      type: 'info',
    },
    
    // Backend processing states (from WebSocket status messages)
    scraping: {
      message: 'Recopilando precios en tiempo real...',
      icon: 'spinner',
      type: 'info',
    },
    normalizing: {
      message: 'Normalizando datos... {count} productos',
      icon: 'spinner',
      type: 'info',
    },
    comparing: {
      message: 'Creando tabla de comparación...',
      icon: 'spinner',
      type: 'info',
    },
    cached: {
      message: 'Obteniendo resultados guardados...',
      icon: 'spinner',
      type: 'info',
    },
    'fetching-rest': {
      message: 'Trayendo datos guardados del backend...',
      icon: 'spinner',
      type: 'info',
    },
    delayed: {
      message: 'La búsqueda está tardando más de lo habitual...',
      icon: 'warning',
      type: 'warning',
    },
    
    // Streaming states
    streaming: {
      message: 'Recibiendo productos...',
      icon: 'spinner',
      type: 'info',
    },
    completed: {
      message: 'Búsqueda completada',
      icon: 'check',
      type: 'success',
    },
    
    // Error states
    error: {
      message: 'Ocurrió un error en la búsqueda',
      icon: 'error',
      type: 'error',
    },
    timeout: {
      message: 'La búsqueda tardó demasiado',
      icon: 'error',
      type: 'error',
    }
  };

  function createStatusTracker() {
    let currentStatus = 'idle';
    let searchStartTime = null;
    let statusUpdateTime = null;
    let productCount = 0;
    let backendPhase = null;
    let isCachedSearch = false;

    return {
      setStatus: function(newStatus) {
        currentStatus = newStatus;
        statusUpdateTime = Date.now();
        
        if (newStatus === 'searching') {
          searchStartTime = Date.now();
          productCount = 0;
          isCachedSearch = false;
        }
        
        const prefix = PriceTracker.constants?.LOG_PREFIX || '[PRICE TRACKER]';
        console.log(`${prefix} [STATUS] ${newStatus}`);
      },

      setBackendPhase: function(phase) {
        // phase can be: 'scraping', 'normalizing', 'comparing', 'cached'
        backendPhase = phase;
        if (phase === 'cached') {
          isCachedSearch = true;
        }
        const prefix = PriceTracker.constants?.LOG_PREFIX || '[PRICE TRACKER]';
        console.log(`${prefix} [BACKEND PHASE] ${phase}`);
      },

      recordProductReceived: function() {
        productCount++;
      },

      setProductCount: function(count) {
        productCount = count;
      },

      getCurrentMessage: function() {
        if (currentStatus === 'searching' && searchStartTime) {
          const elapsedMs = Date.now() - searchStartTime;
          const elapsedSecs = Math.round(elapsedMs / 1000);
          
          // After 6 seconds, show "taking longer" message if still searching
          if (elapsedSecs > 6 && productCount === 0) {
            return {
              status: 'delayed',
              ...STATUS_MESSAGES.delayed,
              detail: `${elapsedSecs}s`,
            };
          }
        }

        // If backend sent a phase, use that message
        if (backendPhase && STATUS_MESSAGES[backendPhase]) {
          const messageData = STATUS_MESSAGES[backendPhase];
          
          // Interpolate {count} placeholder for normalizing phase
          if (backendPhase === 'normalizing' && messageData.message.includes('{count}')) {
            return {
              status: backendPhase,
              ...messageData,
              message: messageData.message.replace('{count}', productCount),
            };
          }
          
          return {
            status: backendPhase,
            ...messageData,
          };
        }

        // Use current status message
        return {
          status: currentStatus,
          ...STATUS_MESSAGES[currentStatus],
        };
      },

      getProductCount: function() {
        return productCount;
      },

      getElapsedTime: function() {
        if (!searchStartTime) return 0;
        return Math.round((Date.now() - searchStartTime) / 1000);
      },

      isCached: function() {
        return isCachedSearch;
      },

      reset: function() {
        currentStatus = 'idle';
        searchStartTime = null;
        statusUpdateTime = null;
        productCount = 0;
        backendPhase = null;
        isCachedSearch = false;
      }
    };
  }

  PriceTracker.statusMessages = {
    STATUS_MESSAGES,
    createStatusTracker,
  };

  const prefix = PriceTracker.constants?.LOG_PREFIX || '[PRICE TRACKER]';
  console.log(`${prefix} Status messages module loaded`);
})(window);
