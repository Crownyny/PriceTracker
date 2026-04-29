// Background Service Worker para la extensión
importScripts('vendor/sockjs.min.js', 'vendor/stomp.umd.min.js', 'setup-dev-config.js', 'dashboard-config.js', 'background/ws-relay.js', 'background/api-relay-handler.js');

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
    
    // Cargar configuración de Firebase desde .env.local (desarrollo)
    await setupDevConfig();
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
  
  // API_REQUEST es manejado por api-relay-handler.js, no lo procesamos aquí
  if (message.type === 'API_REQUEST') {
    return true; // Mantener el canal abierto para api-relay-handler.js
  }
  
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
      (async () => {
        const baseDashboardUrl = (globalThis.PriceTracker?.dashboardConfigManager?.getDashboardUrl)
          ? await globalThis.PriceTracker.dashboardConfigManager.getDashboardUrl()
          : 'http://localhost:4200/dashboard';

        const deepLinkUrl = buildDashboardDeepLink(baseDashboardUrl, {
          productRef: message.productRef,
          query: message.query,
        });

        return chrome.tabs.create({ url: deepLinkUrl })
          .then(() => sendResponse({ success: true }))
          .catch(error => sendResponse({ success: false, error: error.message }));
      })();
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

function buildDashboardDeepLink(baseDashboardUrl, payload) {
  try {
    const url = new URL(baseDashboardUrl);
    // If config points to /dashboard, replace with /open-product
    const pathname = url.pathname.replace(/\/$/, '');
    if (pathname.endsWith('/dashboard')) {
      url.pathname = pathname.slice(0, -'/dashboard'.length) + '/open-product';
    } else {
      url.pathname = '/open-product';
    }

    if (payload?.productRef) {
      url.searchParams.set('productRef', String(payload.productRef));
    }
    if (payload?.query) {
      url.searchParams.set('query', String(payload.query));
    }

    return url.toString();
  } catch (err) {
    // Fallback
    const fallback = 'http://localhost:4200/open-product';
    const qs = new URLSearchParams();
    if (payload?.productRef) qs.set('productRef', String(payload.productRef));
    if (payload?.query) qs.set('query', String(payload.query));
    const suffix = qs.toString();
    return suffix ? `${fallback}?${suffix}` : fallback;
  }
}

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
