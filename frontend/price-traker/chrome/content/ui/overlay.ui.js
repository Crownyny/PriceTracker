(function initOverlayUi(global) {
  const PriceTracker = (global.PriceTracker = global.PriceTracker || {});

  const OVERLAY_ID = 'price-tracker-overlay';

  function show(data, options) {
    const cfg = options || {};
    const onClose = cfg.onClose || (() => {});
    const onOpenDashboard = cfg.onOpenDashboard || (() => {});
    const insertAnchor = cfg.insertAnchor;
    const stateMessage = cfg.stateMessage || '';

    remove();

    const stores = Array.isArray(data.stores) ? data.stores : [];
    const hasStores = stores.length > 0;

    const bestStore = stores.find((store) => store.isBest) || stores[0] || null;
    const highestPrice = hasStores ? Math.max(...stores.map((store) => store.price)) : 0;
    const savings = bestStore ? highestPrice - bestStore.price : 0;

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'price-tracker-overlay-inline';

    overlay.innerHTML = `
      <div class="price-tracker-container">
        <div class="price-tracker-header">
          <img src="${escapeHtml(data.productImage)}" alt="${escapeHtml(data.productName)}" class="product-image">
          <div class="product-info">
            <h2 class="product-name">${escapeHtml(data.productName)}</h2>
            <p class="product-meta">${stores.length} tiendas encontradas - ${escapeHtml(data.productCategory)}</p>
            ${stateMessage ? `<p class="product-stream-state">${escapeHtml(stateMessage)}</p>` : ''}
          </div>
          <button class="price-tracker-close">x</button>
        </div>

        <div class="price-tracker-content">
          <div class="best-price-section">
            <div class="best-price-card">
              <div class="best-price-label">
                <span class="icon">🏆</span>
                <span class="text">Mejor precio encontrado</span>
              </div>
              ${bestStore ? `<p class="best-price-value">$${bestStore.price.toLocaleString('es-CO')}</p>` : '<p class="best-price-value">--</p>'}
              ${bestStore ? `<div class="best-price-store">
                <img src="${escapeHtml(bestStore.logo)}" alt="${escapeHtml(bestStore.name)}">
                <span>${escapeHtml(bestStore.name)}</span>
              </div>` : '<p class="best-price-store-empty">Esperando resultados...</p>'}

              ${bestStore ? `<div class="savings-badge">
                <span class="icon">↓</span>
                <span class="text">Ahorras <strong>$${savings.toLocaleString('es-CO')}</strong> vs. el precio mas alto</span>
              </div>` : ''}

              ${bestStore ? `<a href="${escapeHtml(bestStore.url)}" target="_blank" class="view-offer-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15,3 21,3 21,9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
                Ver oferta
              </a>` : ''}
            </div>
          </div>

          <div class="price-comparison-section">
            <div class="comparison-header">
              <span class="comparison-title">Comparacion de precios</span>
              <span class="stores-count">${stores.length} tiendas</span>
            </div>

            <div class="stores-grid">
              ${stores
                .map((store) => {
                  const shippingClass = store.shipping.toLowerCase().includes('gratis') ? '' : 'paid';
                  const diff = store.price - bestStore.price;
                  return `
                    <a href="${escapeHtml(store.url)}" target="_blank" class="store-item ${store.isBest ? 'best' : ''}">
                      ${store.isBest ? '<span class="best-badge">Mejor</span>' : ''}
                      <img src="${escapeHtml(store.logo)}" alt="${escapeHtml(store.name)}" class="store-logo">
                      <div class="store-info">
                        <p class="store-name">${escapeHtml(store.name)}</p>
                        <p class="store-shipping ${shippingClass}">${escapeHtml(store.shipping)}</p>
                      </div>
                      <div class="store-price">
                        <p class="price-value">$${store.price.toLocaleString('es-CO')}</p>
                        ${store.isBest ? '' : `<p class="price-diff">+$${diff.toLocaleString('es-CO')}</p>`}
                      </div>
                    </a>
                  `;
                })
                .join('')}
              ${!hasStores ? '<div class="stores-empty">Aun no llegan productos desde la cola de eventos.</div>' : ''}
            </div>

            <button class="see-more-stores">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
              Ver ${stores.length > 4 ? stores.length - 4 : 1} tiendas mas
            </button>
          </div>
        </div>

        <div class="price-tracker-footer">
          <a href="#" class="dashboard-link" id="open-dashboard">Ir a PriceTracker Dashboard →</a>
        </div>
      </div>
    `;

    if (insertAnchor && insertAnchor.parentNode) {
      insertAnchor.parentNode.insertBefore(overlay, insertAnchor);
    } else {
      document.body.insertBefore(overlay, document.body.firstChild);
    }

    const closeButton = overlay.querySelector('.price-tracker-close');
    const dashboardLink = overlay.querySelector('#open-dashboard');

    if (closeButton) {
      closeButton.addEventListener('click', onClose);
    }
    if (dashboardLink) {
      dashboardLink.addEventListener('click', (event) => {
        event.preventDefault();
        onOpenDashboard();
      });
    }
  }

  function remove() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.remove();
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  PriceTracker.overlayUi = {
    show,
    remove,
  };
})(window);
