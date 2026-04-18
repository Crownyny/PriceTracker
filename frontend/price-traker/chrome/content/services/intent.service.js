(function initIntentService(global) {
  const PriceTracker = (global.PriceTracker = global.PriceTracker || {});
  const { constants, domainContracts } = PriceTracker;

  /**
   * Envía una consulta al modelo de intención para determinar si es una compra o una solicitud de información.
   * @param {string} query - La consulta del usuario
   * @returns {Promise<Object>} Objeto con input, p_buy, label, threshold
   */
  async function evaluateIntent(query) {
    if (!query || typeof query !== 'string') {
      throw new Error('La query es requerida para evaluar intención');
    }

    const endpoint = `${constants.API.BASE_URL}${constants.API.REST_INTENT_PATH}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query.trim(),
      }),
    }).catch(() => null);

    if (!response?.ok) {
      throw new Error('No se pudo evaluar la intención del usuario');
    }

    const payload = await response.json();
    
    if (!domainContracts.isValidIntentResponseDto(payload)) {
      throw new Error('Respuesta inválida del servicio de intención');
    }

    return transformIntentResponse(payload);
  }

  function transformIntentResponse(dto) {
    return {
      input: dto.input ?? null,
      probability: parseFloat(dto.p_buy ?? 0),
      label: dto.label ?? 'UNKNOWN',
      threshold: parseFloat(dto.threshold ?? 0.5),
      isBuyIntent: dto.label === 'BUY',
    };
  }

  PriceTracker.intentService = {
    evaluateIntent,
  };
})(window);
