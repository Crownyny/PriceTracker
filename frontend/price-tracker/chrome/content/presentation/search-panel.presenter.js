(function initSearchPanelPresenter(global) {
  const PriceTracker = (global.PriceTracker = global.PriceTracker || {});
  const maxStoresCandidates = PriceTracker.constants?.UI?.MAX_STORES_CANDIDATES || 120;

  function toOverlayData(workflowState) {
    const products = workflowState.products || [];
    const totalResults = products.length;
    const selectedProducts = selectRelevantProducts(products, maxStoresCandidates);
    const best = selectedProducts[0];
    const stores = selectedProducts.map((product, index) => ({
      name: product.sourceName || `Fuente ${index + 1}`,
      price: product.price,
      shipping: product.availability ? 'Disponible' : 'Sin disponibilidad',
      url: product.sourceUrl || '#',
      logo: buildLogoFromSource(product.sourceName),
      thumbnail: product.imageUrl || buildImagePlaceholder('Product', '#e2e8f0', '#94a3b8'),
      isBest: index === 0,
    }));

    const fallback = workflowState.activeSearch?.query || 'Busqueda';
    const statusMessage = workflowState.statusMessage || {};

    return {
      productName: best?.canonicalName || fallback,
      productCategory: best?.category || 'General',
      productImage: best?.imageUrl || buildImagePlaceholder('PR', '#e2e8f0', '#334155'),
      stores,
      totalResults,
      relevantStoresCount: stores.length,
      hiddenResultsCount: Math.max(0, totalResults - stores.length),
      searchKey: workflowState.activeSearch?.query || 'default-search',
      status: workflowState.status,
      statusMessage: statusMessage.message || '',
      statusIcon: statusMessage.icon || 'info',
      statusType: statusMessage.type || 'info',
      elapsedTime: workflowState.elapsedTime || 0,
      fallbackInProgress: workflowState.fallbackInProgress,
    };
  }

  function selectRelevantProducts(products, limit) {
    if (!Array.isArray(products) || products.length === 0) {
      return [];
    }

    const validProducts = products.filter((product) => Number.isFinite(Number(product?.price)) && Number(product.price) > 0);
    
    // Reduce outlier filtering to avoid removing too many products
    const filteredByOutlier = removePriceOutliersLenient(validProducts);
    const sourcePool = filteredByOutlier.length > 0 ? filteredByOutlier : validProducts;

    if (sourcePool.length === 0) {
      return [];
    }

    // Sort by price and take top N directly without grouping by store
    // This shows product variety, not just one per store
    return sourcePool
      .sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
      .slice(0, limit);
  }
  
  function removePriceOutliersLenient(products) {
    if (!Array.isArray(products) || products.length < 4) {
      return products || [];
    }
    
    const sorted = products
      .map((p) => Number(p.price))
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b);
    
    if (sorted.length < 4) {
      return products;
    }
    
    const median = computeMedian(sorted);
    if (!Number.isFinite(median) || median <= 0) {
      return products;
    }
    
    // More lenient outlier detection: 0.05 to 20x median (instead of 0.1 to 10x)
    const minReasonable = median * 0.05;
    const maxReasonable = median * 20;
    
    return products.filter((product) => {
      const price = Number(product.price);
      return Number.isFinite(price) && price >= minReasonable && price <= maxReasonable;
    });
  }

  function removePriceOutliers(products) {
    if (!Array.isArray(products) || products.length < 4) {
      return products || [];
    }

    const sorted = products
      .map((p) => Number(p.price))
      .filter((n) => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b);

    if (sorted.length < 4) {
      return products;
    }

    const median = computeMedian(sorted);
    if (!Number.isFinite(median) || median <= 0) {
      return products;
    }

    // Evita seleccionar como "mejor" precios absurdamente bajos/altos frente al conjunto.
    const minReasonable = median * 0.1;
    const maxReasonable = median * 10;

    return products.filter((product) => {
      const price = Number(product.price);
      return Number.isFinite(price) && price >= minReasonable && price <= maxReasonable;
    });
  }

  function computeMedian(values) {
    const mid = Math.floor(values.length / 2);
    if (values.length % 2 === 0) {
      return (values[mid - 1] + values[mid]) / 2;
    }
    return values[mid];
  }

  function normalizeSource(sourceName) {
    return String(sourceName || 'desconocida').trim().toLowerCase();
  }

  function statusMessage(status) {
    switch (status) {
      case 'connecting':
        return 'Conectando a PriceTracker...';
      case 'searching':
        return 'Buscando en fuentes configuradas...';
      case 'streaming':
        return 'Llegando resultados en tiempo real...';
      case 'completed':
        return 'Busqueda completada';
      case 'error':
        return 'Busqueda con error';
      default:
        return 'Listo';
    }
  }

  function buildLogoFromSource(sourceName) {
    const source = (sourceName || '').toLowerCase();
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

  PriceTracker.searchPanelPresenter = {
    toOverlayData,
    statusMessage,
  };
})(window);
