// Background Service Worker para la extensión
console.log('Price Tracker Background Service Worker iniciado');

// Estado global
let extensionActive = false;

// Hidratar estado al iniciar/reiniciar el service worker
hydrateExtensionState();

async function hydrateExtensionState() {
  try {
    const result = await chrome.storage.local.get(['extensionActive']);
    extensionActive = result.extensionActive ?? false;
    console.log(`Estado inicial cargado: ${extensionActive ? 'activada' : 'desactivada'}`);
  } catch (error) {
    console.error('Error cargando estado inicial:', error);
  }
}

// Inicializar el estado cuando se instala la extensión
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Extensión instalada');

  const current = await chrome.storage.local.get(['extensionActive', 'searchHistory', 'subscriptions']);
  await chrome.storage.local.set({
    extensionActive: current.extensionActive ?? false,
    searchHistory: current.searchHistory ?? [],
    subscriptions: current.subscriptions ?? []
  });
});

// Escuchar mensajes desde el popup y content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Mensaje recibido:', message);
  
  switch (message.type) {
    case 'TOGGLE_EXTENSION':
      handleToggleExtension(message.active)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      break;
      
    case 'PRODUCT_DETECTED':
      handleProductDetected(message.data, sender.tab);
      sendResponse({ success: true });
      break;
      
    case 'GET_EXTENSION_STATE':
      sendResponse({ active: extensionActive });
      break;

    case 'OPEN_DASHBOARD':
      chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') })
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      break;
      
    case 'FETCH_PRICES':
      handleFetchPrices(message.productQuery, sender.tab)
        .then(data => sendResponse({ success: true, data }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Mantener el canal abierto para respuesta asíncrona
      
    default:
      sendResponse({ success: false, error: 'Tipo de mensaje desconocido' });
  }
});

// Manejar activación/desactivación de la extensión
async function handleToggleExtension(active) {
  extensionActive = active;
  await chrome.storage.local.set({ extensionActive: active });
  console.log(`Extensión ${active ? 'activada' : 'desactivada'}`);
  
  // Notificar a todos los content scripts del cambio
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'EXTENSION_STATE_CHANGED',
      active: active
    }).catch(() => {
      // Ignorar errores si el content script no está cargado
    });
  }
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes.extensionActive) {
    return;
  }

  extensionActive = Boolean(changes.extensionActive.newValue);
});

// Manejar cuando se detecta un producto
async function handleProductDetected(data, tab) {
  if (!extensionActive) {
    console.log('Extensión desactivada, ignorando detección de producto');
    return;
  }
  
  console.log('Producto detectado:', data);
  
  // Aquí irá la lógica para comunicarse con el backend
  // Por ahora, solo guardamos en el historial
  await addToSearchHistory(data);
}

// Obtener precios desde el backend
async function handleFetchPrices(productQuery, tab) {
  console.log('Obteniendo precios para:', productQuery);
  
  // TODO: Implementar llamada real al backend
  // const response = await fetch('http://localhost:8000/api/prices', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ query: productQuery })
  // });
  // return await response.json();
  
  // Datos de prueba mientras se implementa el backend
  return {
    products: [
      {
        name: 'Producto de ejemplo',
        price: 99.99,
        store: 'Amazon',
        url: 'https://amazon.com/example',
        image: 'https://via.placeholder.com/150'
      },
      {
        name: 'Producto de ejemplo',
        price: 89.99,
        store: 'MercadoLibre',
        url: 'https://mercadolibre.com/example',
        image: 'https://via.placeholder.com/150'
      }
    ]
  };
}

// Agregar al historial de búsquedas
async function addToSearchHistory(searchData) {
  const result = await chrome.storage.local.get(['searchHistory']);
  const history = result.searchHistory || [];
  
  history.unshift({
    ...searchData,
    timestamp: new Date().toISOString()
  });
  
  // Mantener solo las últimas 50 búsquedas
  const trimmedHistory = history.slice(0, 50);
  
  await chrome.storage.local.set({ searchHistory: trimmedHistory });
}

// Escuchar cambios en las pestañas
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Solo actuar cuando la página haya terminado de cargar
  if (changeInfo.status === 'complete' && extensionActive) {
    console.log('Pestaña actualizada:', tab.url);
    // Aquí podrías detectar si está en un sitio de búsqueda
  }
});
