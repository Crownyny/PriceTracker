(function initPricingService(global) {
  const PriceTracker = (global.PriceTracker = global.PriceTracker || {});
  const { constants, domainContracts } = PriceTracker;

  async function restoreByProductRef(productRef, query) {
    if (constants.API.USE_MOCK) {
      return buildMockProducts(productRef, query);
    }

    if (!productRef) {
      throw new Error('No se recibio product_ref para fallback REST');
    }

    // Contrato backend actual: POST /api/products/search con body QueryDTOIN.
    const endpoint = `${constants.API.BASE_URL}${constants.API.REST_SEARCH_PATH}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        product_ref: productRef,
      }),
    }).catch(() => null);

    if (!response?.ok) {
      throw new Error('No se pudo recuperar estado por REST fallback (POST /api/products/search)');
    }

    const payload = await response.json();
    return mapProducts(payload);
  }

  function mapProducts(payload) {
    if (!Array.isArray(payload)) {
      return [];
    }

    return payload
      .filter(domainContracts.isValidNormalizedProductDto)
      .map(domainContracts.toDomainProduct);
  }

  function buildMockProducts(productRef, query) {
    const dto = [
      {
        product_ref: productRef || 'mock-product-ref',
        source_name: 'mercadolibre',
        canonical_name: query || 'Producto mock',
        price: 7599000,
        currency: 'COP',
        category: 'Electronica',
        availability: true,
        updated_at: new Date().toISOString(),
        source_url: 'https://mercadolibre.com/example',
        image_url: 'https://via.placeholder.com/80/f3f4f6/1f2937?text=IMG',
      },
      {
        product_ref: productRef || 'mock-product-ref',
        source_name: 'amazon',
        canonical_name: query || 'Producto mock',
        price: 7999000,
        currency: 'COP',
        category: 'Electronica',
        availability: true,
        updated_at: new Date().toISOString(),
        source_url: 'https://amazon.com/example',
        image_url: 'https://via.placeholder.com/80/f3f4f6/1f2937?text=IMG',
      },
    ];

    return dto.map(domainContracts.toDomainProduct);
  }

  PriceTracker.pricingService = {
    restoreByProductRef,
  };
})(window);
