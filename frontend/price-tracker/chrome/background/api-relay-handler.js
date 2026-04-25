// API Request Handler para Background Script
// Maneja las peticiones desde el content script y las relaya a localhost

const GOOGLE_SEARCH_HOSTS = new Set([
  'www.google.com',
  'www.google.com.co',
  'google.com',
  'google.com.co'
]);

/**
 * Maneja peticiones API desde el content script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'API_REQUEST') {
    handleApiRequest(message, sender, sendResponse);
    return true; // Indica que la respuesta es asíncrona
  }
});

/**
 * Realiza la petición HTTP actual
 */
async function handleApiRequest(message, sender, sendResponse) {
  try {
    const { endpoint, options } = message;
    const apiConfig = globalThis.PriceTracker?.constants?.API || {};
    const allowedMethods = new Set(apiConfig.RELAY_ALLOWED_METHODS || ['POST']);
    const allowedEndpoints = new Set(apiConfig.RELAY_ALLOWED_ENDPOINTS || ['/api/intent/intent', '/api/products/search']);

    if (!isAllowedSender(sender)) {
      throw new Error('Sender no autorizado para API relay');
    }

    if (!isAllowedEndpoint(endpoint, allowedEndpoints)) {
      throw new Error('Endpoint no permitido por API relay');
    }
    
    const baseUrl = 'http://localhost:8080';
    const url = `${baseUrl}${endpoint}`;
    const method = String(options?.method || 'GET').toUpperCase();

    if (!allowedMethods.has(method)) {
      throw new Error('Método no permitido por API relay');
    }

    const headers = sanitizeHeaders(options?.headers || {});
    console.log(`[API_RELAY - BACKGROUND] Petición permitida: ${method} ${url}`);

    const bodyString = options?.body ? JSON.stringify(options.body) : undefined;

    // Construir fetchOptions de forma explícita para evitar pasar campos no permitidos.
    const fetchOptions = {
      method,
      headers,
    };

    // Añadir body solo si existe (string ya serializado)
    if (bodyString) {
      fetchOptions.body = bodyString;
    }

    const response = await fetch(url, fetchOptions);

    // Leer el body
    let data = null;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Enviar respuesta al content script
    sendResponse({
      success: true,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
      data: data,
      text: data
    });
  } catch (error) {
    console.error(`[API_RELAY - BACKGROUND] Error en petición segura:`, error.message);
    sendResponse({
      success: false,
      error: error.message,
      status: 0
    });
  }
}

function isAllowedSender(sender) {
  if (!sender || !sender.tab || !sender.url) {
    return false;
  }

  try {
    const url = new URL(sender.url);
    return GOOGLE_SEARCH_HOSTS.has(url.hostname) && url.pathname.startsWith('/search');
  } catch (error) {
    return false;
  }
}

function isAllowedEndpoint(endpoint, allowedEndpoints) {
  return typeof endpoint === 'string' && allowedEndpoints.has(endpoint);
}

function sanitizeHeaders(headers) {
  const safeHeaders = {};
  const allowedHeaderNames = new Set(['content-type', 'authorization']);

  for (const [key, value] of Object.entries(headers || {})) {
    if (allowedHeaderNames.has(String(key).toLowerCase())) {
      safeHeaders[key] = value;
    }
  }

  return safeHeaders;
}
