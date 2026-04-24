// API Relay Service para el Background Script
// Permite que el content script acceda a localhost bypaseando CORS

(function initApiRelay(global) {
  const PriceTracker = (global.PriceTracker = global.PriceTracker || {});
  
  /**
   * Realiza una petición HTTP a través del background script
   * @param {string} endpoint - URL del endpoint (ej: /api/intent/intent)
   * @param {Object} options - Opciones fetch (method, headers, body, etc)
   * @returns {Promise<Response>}
   */
  async function apiRequest(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      // Enviar mensaje al background
      chrome.runtime.sendMessage(
        {
          type: 'API_REQUEST',
          endpoint: endpoint,
          options: options
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('[API_RELAY] Error comunicando con background:', chrome.runtime.lastError);
            reject(new Error(`Background communication error: ${chrome.runtime.lastError.message}`));
            return;
          }

          if (response && response.success) {
            // Convertir respuesta a Response-like object
            const responseObj = {
              ok: response.ok,
              status: response.status,
              statusText: response.statusText,
              headers: new Headers(response.headers || {}),
              json: async () => response.data,
              text: async () => response.text || JSON.stringify(response.data),
              blob: async () => new Blob([JSON.stringify(response.data)]),
            };
            resolve(responseObj);
          } else {
            reject(new Error(response?.error || 'API request failed'));
          }
        }
      );
    });
  }

  PriceTracker.apiRelay = {
    apiRequest
  };

  console.log('[API_RELAY] Content script relay service loaded');
})(window);
