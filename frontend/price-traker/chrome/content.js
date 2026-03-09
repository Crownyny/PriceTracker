// Content Script - Se ejecuta en el contexto de las paginas web
console.log('[PRICE TRACKER] Content Script cargado!');
console.log('[PRICE TRACKER] URL actual:', window.location.href);

let extensionActive = false;
let overlayInjected = false;

// Inicializar
init();

async function init() {
  console.log('[PRICE TRACKER] Inicializando...');
  
  // Obtener el estado de la extension desde storage directamente
  const state = await getExtensionState();
  extensionActive = state.active;
  
  console.log('[PRICE TRACKER] Estado de la extension:', extensionActive ? 'ACTIVADA' : 'DESACTIVADA');
  
  if (extensionActive) {
    startMonitoring();
  } else {
    console.log('[PRICE TRACKER] Extension desactivada. Activala desde el popup.');
  }
}

// Obtener estado de la extension desde storage
async function getExtensionState() {
  try {
    const result = await chrome.storage.local.get(['extensionActive']);
    return { active: result.extensionActive ?? false };
  } catch (error) {
    console.error('[PRICE TRACKER] Error obteniendo estado:', error);
    return { active: false };
  }
}

// Escuchar mensajes desde el background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'EXTENSION_STATE_CHANGED':
      extensionActive = message.active;
      console.log('[PRICE TRACKER] Estado cambiado a:', message.active);
      if (extensionActive) {
        startMonitoring();
      } else {
        stopMonitoring();
      }
      sendResponse({ success: true });
      break;
      
    case 'SHOW_PRICE_OVERLAY':
      showPriceOverlay(message.data);
      sendResponse({ success: true });
      break;
      
    default:
      sendResponse({ success: false });
  }
});

// Iniciar monitoreo de la pagina
function startMonitoring() {
  console.log('[PRICE TRACKER] Iniciando monitoreo de productos...');
  
  // Mostrar indicador de estado
  showStatusIndicator();
  
  // Detectar si estamos en una pagina de busqueda o producto
  detectSearchQuery();
  
  // Observar cambios en la URL (para SPAs)
  observeURLChanges();
  
  console.log('[PRICE TRACKER] Monitoreo activo');
}

// Detener monitoreo
function stopMonitoring() {
  console.log('[PRICE TRACKER] Deteniendo monitoreo...');
  removeStatusIndicator();
  removeOverlay();
}

// Mostrar indicador de estado en la esquina
function showStatusIndicator() {
  // No mostrar si ya existe
  if (document.getElementById('price-tracker-status')) return;
  
  const indicator = document.createElement('div');
  indicator.id = 'price-tracker-status';
  indicator.className = 'price-tracker-status-indicator';
  
  indicator.innerHTML = `
    <div class="status-icon">⚡</div>
    <div class="status-text">
      <span class="status-title">PriceTracker</span>
      <span class="status-label">Activado</span>
    </div>
    <div class="status-toggle" id="status-toggle"></div>
  `;
  
  document.body.appendChild(indicator);
  
  // Toggle click handler
  indicator.querySelector('#status-toggle').addEventListener('click', async () => {
    await chrome.storage.local.set({ extensionActive: false });
    extensionActive = false;
    stopMonitoring();
  });
}

// Remover indicador de estado
function removeStatusIndicator() {
  const indicator = document.getElementById('price-tracker-status');
  if (indicator) indicator.remove();
}

// Detectar consulta de busqueda en la pagina
function detectSearchQuery() {
  const url = window.location.href;
  console.log('[PRICE TRACKER] Detectando busqueda en:', url);
  
  // Detectar busquedas en Google
  if (url.includes('google.com/search') || url.includes('google.co')) {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');
    console.log('[PRICE TRACKER] Parametro de busqueda (q):', query);
    if (query) {
      console.log('[PRICE TRACKER] Busqueda detectada:', query);
      handleSearchQuery(query);
    } else {
      console.log('[PRICE TRACKER] No se encontro parametro de busqueda');
    }
  } else {
    console.log('[PRICE TRACKER] No es una pagina de busqueda de Google');
  }
}

// Manejar consulta de busqueda
async function handleSearchQuery(query) {
  console.log('[PRICE TRACKER] Procesando busqueda:', query);
  
  // Por ahora, mostrar overlay directamente con datos de prueba
  // En produccion, aqui enviarias al backend para verificar si es producto
  console.log('[PRICE TRACKER] Simulando consulta al backend...');
  setTimeout(() => {
    console.log('[PRICE TRACKER] Mostrando resultados de precios');
    fetchAndShowPrices(query);
  }, 1000); // Esperar 1 segundo para simular llamada al backend
}

// Obtener y mostrar precios
async function fetchAndShowPrices(productQuery) {
  console.log('[PRICE TRACKER] Obteniendo precios para:', productQuery);
  
  // Datos de prueba - en produccion esto vendria del backend
  const mockData = {
    productName: productQuery,
    productCategory: 'Electronica',
    productImage: 'https://via.placeholder.com/80/f3f4f6/1f2937?text=IMG',
    stores: [
      {
        name: 'Mercado Libre',
        price: 7599000,
        shipping: '+$100 envio',
        url: 'https://mercadolibre.com/example',
        logo: 'https://via.placeholder.com/40/ffe600/000000?text=ML',
        isBest: true
      },
      {
        name: 'Amazon',
        price: 7999000,
        shipping: 'Envio gratis',
        url: 'https://amazon.com/example',
        logo: 'https://via.placeholder.com/40/ff9900/000000?text=AZ',
        isBest: false
      },
      {
        name: 'Liverpool',
        price: 7899000,
        shipping: 'Envio gratis',
        url: 'https://liverpool.com/example',
        logo: 'https://via.placeholder.com/40/e91e8c/ffffff?text=LV',
        isBest: false
      },
      {
        name: 'Walmart',
        price: 8200000,
        shipping: 'Envio gratis',
        url: 'https://walmart.com/example',
        logo: 'https://via.placeholder.com/40/0071ce/ffffff?text=WM',
        isBest: false
      }
    ]
  };
  
  showPriceOverlay(mockData);
}

// Mostrar overlay con precios
function showPriceOverlay(data) {
  console.log('[PRICE TRACKER] Mostrando overlay...');
  
  // Remover overlay anterior si existe
  removeOverlay();
  
  // Encontrar mejor precio y calcular ahorro
  const bestStore = data.stores.find(s => s.isBest) || data.stores[0];
  const highestPrice = Math.max(...data.stores.map(s => s.price));
  const savings = highestPrice - bestStore.price;
  
  // Crear overlay como widget integrado
  const overlay = document.createElement('div');
  overlay.id = 'price-tracker-overlay';
  overlay.className = 'price-tracker-overlay-inline';
  
  overlay.innerHTML = `
    <div class="price-tracker-container">
      <!-- Header -->
      <div class="price-tracker-header">
        <img src="${data.productImage}" alt="${data.productName}" class="product-image">
        <div class="product-info">
          <h2 class="product-name">${data.productName}</h2>
          <p class="product-meta">${data.stores.length} tiendas encontradas - ${data.productCategory}</p>
        </div>
        <button class="price-tracker-close">x</button>
      </div>
      
      <!-- Content -->
      <div class="price-tracker-content">
        <!-- Panel izquierdo - Mejor precio -->
        <div class="best-price-section">
          <div class="best-price-card">
            <div class="best-price-label">
              <span class="icon">🏆</span>
              <span class="text">Mejor precio encontrado</span>
            </div>
            <p class="best-price-value">$${bestStore.price.toLocaleString('es-CO')}</p>
            <div class="best-price-store">
              <img src="${bestStore.logo}" alt="${bestStore.name}">
              <span>${bestStore.name}</span>
            </div>
            
            <div class="savings-badge">
              <span class="icon">↓</span>
              <span class="text">Ahorras <strong>$${savings.toLocaleString('es-CO')}</strong> vs. el precio mas alto</span>
            </div>
            
            <a href="${bestStore.url}" target="_blank" class="view-offer-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15,3 21,3 21,9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
              Ver oferta
            </a>
          </div>
        </div>
        
        <!-- Panel derecho - Comparacion -->
        <div class="price-comparison-section">
          <div class="comparison-header">
            <span class="comparison-title">Comparacion de precios</span>
            <span class="stores-count">${data.stores.length} tiendas</span>
          </div>
          
          <div class="stores-grid">
            ${data.stores.map(store => {
              const shippingClass = store.shipping.toLowerCase().includes('gratis') ? '' : 'paid';
              return `
                <a href="${store.url}" target="_blank" class="store-item ${store.isBest ? 'best' : ''}">
                  ${store.isBest ? '<span class="best-badge">Mejor</span>' : ''}
                  <img src="${store.logo}" alt="${store.name}" class="store-logo">
                  <div class="store-info">
                    <p class="store-name">${store.name}</p>
                    <p class="store-shipping ${shippingClass}">${store.shipping}</p>
                  </div>
                  <div class="store-price">
                    <p class="price-value">$${store.price.toLocaleString('es-CO')}</p>
                    ${!store.isBest ? `<p class="price-diff">+$${(store.price - bestStore.price).toLocaleString('es-CO')}</p>` : ''}
                  </div>
                </a>
              `;
            }).join('')}
          </div>
          
          <button class="see-more-stores">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
            Ver ${data.stores.length > 4 ? data.stores.length - 4 : 1} tiendas mas
          </button>
        </div>
      </div>
      
      <!-- Footer -->
      <div class="price-tracker-footer">
        <a href="#" class="dashboard-link" id="open-dashboard">
          Ir a PriceTracker Dashboard →
        </a>
      </div>
    </div>
  `;
  
  // Insertar en la pagina de Google (despues de la barra de busqueda)
  const insertLocation = findInsertLocation();
  if (insertLocation) {
    insertLocation.parentNode.insertBefore(overlay, insertLocation);
    console.log('[PRICE TRACKER] Overlay insertado en los resultados de Google');
  } else {
    // Fallback: insertar al inicio del body
    document.body.insertBefore(overlay, document.body.firstChild);
    console.log('[PRICE TRACKER] Overlay insertado al inicio del body (fallback)');
  }
  
  overlayInjected = true;
  
  // Event listeners
  overlay.querySelector('.price-tracker-close').addEventListener('click', removeOverlay);
  overlay.querySelector('#open-dashboard').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
  });
}

// Encontrar el mejor lugar para insertar el overlay en Google
function findInsertLocation() {
  // Intentar encontrar el contenedor principal de resultados de Google
  const selectors = [
    '#search',           // Contenedor de resultados de busqueda
    '#rso',              // Resultados organicos
    '#main',             // Contenedor principal
    '#center_col',       // Columna central
    '[role="main"]',     // Rol principal
  ];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element;
    }
  }
  
  return null;
}

// Remover overlay
function removeOverlay() {
  const overlay = document.getElementById('price-tracker-overlay');
  
  if (overlay) overlay.remove();
  
  overlayInjected = false;
  console.log('[PRICE TRACKER] Overlay removido');
}

// Observar cambios en la URL (para SPAs)
function observeURLChanges() {
  let lastUrl = window.location.href;
  
  const observer = new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      console.log('[PRICE TRACKER] URL cambio a:', currentUrl);
      detectSearchQuery();
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}
