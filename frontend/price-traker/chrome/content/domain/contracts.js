(function initDomainContracts(global) {
  const PriceTracker = (global.PriceTracker = global.PriceTracker || {});

  function isValidNormalizedProductDto(payload) {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    return typeof payload.product_ref === 'string'
      && typeof payload.source_name === 'string'
      && payload.updated_at != null;
  }

  function isValidExceptionDto(payload) {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    return typeof payload.message === 'string'
      && Object.prototype.hasOwnProperty.call(payload, 'product_ref')
      && Object.prototype.hasOwnProperty.call(payload, 'update_at');
  }

  function toDomainProduct(dto) {
    return {
      id: dto.id ?? null,
      productRef: dto.product_ref ?? null,
      sourceName: dto.source_name ?? null,
      canonicalName: dto.canonical_name ?? null,
      price: Number(dto.price ?? 0),
      currency: dto.currency ?? 'COP',
      category: dto.category ?? 'Sin categoria',
      availability: Boolean(dto.availability),
      updatedAt: dto.updated_at ?? null,
      scrapedAt: dto.scraped_at ?? null,
      sourceUrl: dto.source_url ?? '#',
      confidence: dto.confidence ?? 'unknown',
      imageUrl: dto.image_url ?? 'https://via.placeholder.com/80/f3f4f6/1f2937?text=IMG',
      description: dto.description ?? '',
      extra: dto.extra ?? {},
    };
  }

  function toDomainException(dto) {
    return {
      message: dto.message,
      productRef: dto.product_ref ?? null,
      updatedAt: dto.update_at ?? null,
      code: parseErrorCode(dto.message),
    };
  }

  function parseErrorCode(message) {
    if (!message) {
      return 'UNKNOWN';
    }
    if (message.includes('PRODUCT_IN_BD')) {
      return 'PRODUCT_IN_BD';
    }
    if (message.includes('TIMEOUT')) {
      return 'TIMEOUT';
    }
    return 'GENERIC_ERROR';
  }

  function buildDedupeKey(product) {
    return `${product.productRef || ''}|${product.sourceName || ''}|${product.updatedAt || ''}`;
  }

  PriceTracker.domainContracts = {
    isValidNormalizedProductDto,
    isValidExceptionDto,
    toDomainProduct,
    toDomainException,
    buildDedupeKey,
  };
})(window);
