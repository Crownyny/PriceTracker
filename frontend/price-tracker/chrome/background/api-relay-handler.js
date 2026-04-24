// API Request Handler para Background Script
// Maneja las peticiones desde el content script y las relaya a localhost

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
    
    const baseUrl = 'http://localhost:8080';
    const url = `${baseUrl}${endpoint}`;

    console.log(`[API_RELAY - BACKGROUND] Realizando petición a: ${url}`);
    console.log(`[API_RELAY - BACKGROUND] Método: ${options.method || 'GET'}`);
    console.log(`[API_RELAY - BACKGROUND] Headers:`, options.headers);
    console.log(`[API_RELAY - BACKGROUND] Body original:`, options.body);

    const bodyString = options.body ? JSON.stringify(options.body) : undefined;
    console.log(`[API_RELAY - BACKGROUND] Body serializado:`, bodyString);

    // Construir fetchOptions sin spread de options para evitar sobrescribir body
    const fetchOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    // Añadir body solo si existe (string ya serializado)
    if (bodyString) {
      fetchOptions.body = bodyString;
    }

    console.log(`[API_RELAY - BACKGROUND] Opciones finales:`, fetchOptions);

    const response = await fetch(url, fetchOptions);

    console.log(`[API_RELAY - BACKGROUND] Respuesta: ${response.status} ${response.statusText}`);
    console.log(`[API_RELAY - BACKGROUND] Content-Type:`, response.headers.get('content-type'));

    // Leer el body
    let data = null;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
      console.log(`[API_RELAY - BACKGROUND] Data (JSON):`, data);
    } else {
      data = await response.text();
      console.log(`[API_RELAY - BACKGROUND] Data (TEXT):`, data);
    }

    console.log(`[API_RELAY - BACKGROUND] Enviando respuesta:`, {
      success: true,
      status: response.status,
      ok: response.ok,
      data: data
    });

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
    console.error(`[API_RELAY - BACKGROUND] Error en petición:`, error);
    sendResponse({
      success: false,
      error: error.message,
      status: 0
    });
  }
}
