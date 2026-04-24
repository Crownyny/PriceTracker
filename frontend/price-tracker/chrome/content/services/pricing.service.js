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

    const prefix = '[PRICING SERVICE]';
    
    console.log(`${prefix} ℹ Requesting REST search via background worker`);
    console.log(`${prefix} ℹ Payload: { "product_ref": "${productRef}" }`);

    // Use background worker to avoid CORS issues
    return new Promise((resolve, reject) => {
      const messageListener = (message, sender, sendResponse) => {
        // Wait for completion message
        if (message.type === 'ws-relay-rest-search-complete') {
          const { count, products } = message.data || {};
          console.log(`${prefix} ✓ REST returned ${count} products`);
          chrome.runtime.onMessage.removeListener(messageListener);
          clearTimeout(timeoutId);
          
          // Extract and map products from message
          const productList = Array.isArray(products) ? products : [];
          resolve(mapProducts(productList));
          return;
        }

        if (message.type === 'ws-relay-rest-search-error') {
          const { error, status } = message.data || {};
          console.error(`${prefix} ❌ REST error:`, error || status);
          chrome.runtime.onMessage.removeListener(messageListener);
          clearTimeout(timeoutId);
          reject(new Error(error || `REST API error ${status}`));
          return;
        }
      };

      chrome.runtime.onMessage.addListener(messageListener);

      // Send request to background worker
      chrome.runtime.sendMessage(
        {
          type: 'ws-relay-rest-search',
          productRef: productRef,
          query: query,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(`${prefix} ❌ Message error:`, chrome.runtime.lastError.message);
            chrome.runtime.onMessage.removeListener(messageListener);
            clearTimeout(timeoutId);
            reject(new Error(chrome.runtime.lastError.message));
          }
        }
      );

      // Set timeout in case background worker doesn't respond
      const timeoutId = setTimeout(() => {
        chrome.runtime.onMessage.removeListener(messageListener);
        reject(new Error('REST search timeout'));
      }, 15000);
    });
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
