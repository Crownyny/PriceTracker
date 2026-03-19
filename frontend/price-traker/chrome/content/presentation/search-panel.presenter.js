(function initSearchPanelPresenter(global) {
  const PriceTracker = (global.PriceTracker = global.PriceTracker || {});

  function toOverlayData(workflowState) {
    const products = workflowState.products || [];
    const best = products[0];
    const stores = products.map((product, index) => ({
      name: product.sourceName || `Fuente ${index + 1}`,
      price: product.price,
      shipping: product.availability ? 'Disponible' : 'Sin disponibilidad',
      url: product.sourceUrl || '#',
      logo: buildLogoFromSource(product.sourceName),
      isBest: index === 0,
    }));

    const fallback = workflowState.activeSearch?.query || 'Busqueda';

    return {
      productName: best?.canonicalName || fallback,
      productCategory: best?.category || 'General',
      productImage: best?.imageUrl || 'https://via.placeholder.com/80/f3f4f6/1f2937?text=IMG',
      stores,
      status: workflowState.status,
      fallbackInProgress: workflowState.fallbackInProgress,
    };
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
      return 'https://via.placeholder.com/40/ff9900/000000?text=AZ';
    }
    if (source.includes('mercado')) {
      return 'https://via.placeholder.com/40/ffe600/000000?text=ML';
    }
    if (source.includes('walmart')) {
      return 'https://via.placeholder.com/40/0071ce/ffffff?text=WM';
    }
    return 'https://via.placeholder.com/40/1d4ed8/ffffff?text=PT';
  }

  PriceTracker.searchPanelPresenter = {
    toOverlayData,
    statusMessage,
  };
})(window);
