(function initOverlayUi(global) {
  const PriceTracker = (global.PriceTracker = global.PriceTracker || {});
  const initialStoresDisplay = PriceTracker.constants?.UI?.INITIAL_STORES_DISPLAY || 5;
  const storesPageStep = PriceTracker.constants?.UI?.STORES_PAGE_STEP || 5;

  const OVERLAY_ID = 'price-tracker-overlay';
  let currentSearchKey = null;
  let visibleStoresCount = initialStoresDisplay;

  function show(data, options) {
    const cfg = options || {};
    const onClose = cfg.onClose || (() => {});
    const onOpenDashboard = cfg.onOpenDashboard || (() => {});
    const insertAnchor = cfg.insertAnchor;
    const stateMessage = cfg.stateMessage || '';
    const searchKey = String(data.searchKey || data.productName || 'default-search');

    if (currentSearchKey !== searchKey) {
      currentSearchKey = searchKey;
      visibleStoresCount = initialStoresDisplay;
    }

    const stores = Array.isArray(data.stores) ? data.stores : [];
    const visibleStores = stores.slice(0, visibleStoresCount);
    const hasStores = visibleStores.length > 0;
    const totalResults = Number(data.totalResults || stores.length || 0);
    const relevantStoresCount = Number(data.relevantStoresCount || stores.length || 0);
    const hiddenStoresCount = Math.max(0, stores.length - visibleStores.length);
    const hiddenResultsCount = Math.max(0, Number(data.hiddenResultsCount || 0));
    const hasMoreStores = hiddenStoresCount > 0;
    const nextBatchCount = Math.min(storesPageStep, hiddenStoresCount);

    const bestStore = stores.find((store) => store.isBest) || stores[0] || null;
    const highestPrice = hasStores ? Math.max(...visibleStores.map((store) => store.price)) : 0;
    const savings = bestStore ? highestPrice - bestStore.price : 0;

    let overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = OVERLAY_ID;

      if (insertAnchor && insertAnchor.parentNode) {
        insertAnchor.parentNode.insertBefore(overlay, insertAnchor);
      } else {
        document.body.insertBefore(overlay, document.body.firstChild);
      }
    }
    overlay.className = `price-tracker-overlay-inline ${resolveThemeClass()}`;

    overlay.innerHTML = `
      <div class="price-tracker-container">
        <div class="price-tracker-header">
          <img src="${escapeHtml(data.productImage)}" alt="${escapeHtml(data.productName)}" class="product-image">
          <div class="product-info">
            <h2 class="product-name">${escapeHtml(data.productName)}</h2>
            <p class="product-meta">${visibleStores.length} de ${relevantStoresCount} tiendas relevantes (${totalResults} resultados totales) - ${escapeHtml(data.productCategory)}</p>
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
              <span class="stores-count">${visibleStores.length} tiendas</span>
            </div>

            <div class="stores-grid">
              ${visibleStores
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

            ${hasMoreStores ? `<button class="see-more-stores" id="see-more-stores-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
              Ver ${nextBatchCount} tiendas mas (${hiddenStoresCount} pendientes)
            </button>` : ''}
            ${hiddenResultsCount > 0 ? `<p class="stores-hidden-note">${hiddenResultsCount} resultados adicionales fueron agrupados para evitar ruido.</p>` : ''}
          </div>
        </div>

        <div class="price-tracker-footer">
          <a href="#" class="dashboard-link" id="open-dashboard">Ir a PriceTracker Dashboard →</a>
        </div>
      </div>
    `;

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

    const seeMoreButton = overlay.querySelector('#see-more-stores-btn');
    if (seeMoreButton) {
      seeMoreButton.addEventListener('click', () => {
        visibleStoresCount += storesPageStep;
        show(data, options);
      });
    }

    bindImageFallbacks(overlay, data, visibleStores);
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

  function bindImageFallbacks(overlay, data, stores) {
    const defaultProduct = buildImagePlaceholder('PR', '#e2e8f0', '#334155');
    const headerImage = overlay.querySelector('.price-tracker-header .product-image');
    if (headerImage) {
      attachFallback(headerImage, data.productImage || defaultProduct, defaultProduct);
    }

    const byStore = new Map((stores || []).map((store) => [String(store.name || '').toLowerCase(), store.logo]));
    const logos = overlay.querySelectorAll('.store-logo, .best-price-store img');
    logos.forEach((img) => {
      const alt = String(img.getAttribute('alt') || '').toLowerCase();
      const preferred = byStore.get(alt) || img.getAttribute('src') || '';
      const fallback = buildLogoByName(alt || 'PT');
      attachFallback(img, preferred, fallback);
    });
  }

  function attachFallback(imgEl, preferredSrc, fallbackSrc) {
    const safeFallback = fallbackSrc || buildLogoByName('PT');
    imgEl.src = preferredSrc || safeFallback;
    imgEl.addEventListener('error', () => {
      if (imgEl.dataset.fallbackApplied === '1') {
        return;
      }
      imgEl.dataset.fallbackApplied = '1';
      imgEl.src = safeFallback;
    });
  }

  function resolveThemeClass() {
    const docTheme = detectThemeFromDocument();
    if (docTheme) {
      return docTheme;
    }

    if (global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'price-tracker-theme-dark';
    }

    return 'price-tracker-theme-light';
  }

  function detectThemeFromDocument() {
    const bodyTheme = inferThemeFromColor(getComputedStyle(document.body).backgroundColor);
    if (bodyTheme) {
      return bodyTheme;
    }

    const rootTheme = inferThemeFromColor(getComputedStyle(document.documentElement).backgroundColor);
    if (rootTheme) {
      return rootTheme;
    }

    return null;
  }

  function inferThemeFromColor(color) {
    if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
      return null;
    }

    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) {
      return null;
    }

    const r = Number(match[1]);
    const g = Number(match[2]);
    const b = Number(match[3]);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance < 0.45 ? 'price-tracker-theme-dark' : 'price-tracker-theme-light';
  }

  function buildLogoByName(sourceName) {
    const source = String(sourceName || '').toLowerCase();
    if (source.includes('amazon')) {
      return buildImagePlaceholder('AZ', '#ffedd5', '#9a3412');
    }
    if (source.includes('mercado')) {
      return buildImagePlaceholder('ML', '#fef9c3', '#854d0e');
    }
    if (source.includes('walmart')) {
      return buildImagePlaceholder('WM', '#dbeafe', '#1e3a8a');
    }
    if (source.includes('exito')) {
      return buildImagePlaceholder('EX', '#fef3c7', '#92400e');
    }
    if (source.includes('homecenter')) {
      return buildImagePlaceholder('HC', '#dbeafe', '#1d4ed8');
    }
    return buildImagePlaceholder('PT', '#dbeafe', '#1d4ed8');
  }

  function buildImagePlaceholder(label, bgColor, fgColor) {
    const text = String(label || 'PT').slice(0, 2).toUpperCase();
    const bg = bgColor || '#dbeafe';
    const fg = fgColor || '#1d4ed8';
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><rect width='80' height='80' rx='12' fill='${bg}'/><text x='40' y='48' text-anchor='middle' font-family='Segoe UI, Arial, sans-serif' font-size='24' font-weight='700' fill='${fg}'>${text}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  PriceTracker.overlayUi = {
    show,
    remove,
  };
})(window);
