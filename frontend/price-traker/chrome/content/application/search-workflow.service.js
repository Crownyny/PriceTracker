(function initSearchWorkflow(global) {
  const PriceTracker = (global.PriceTracker = global.PriceTracker || {});
  const { constants, domainContracts, pricingService, stompSockJsClientFactory } = PriceTracker;

  function createWorkflow() {
    const client = stompSockJsClientFactory.createClient();
    const restFallbackEnabled = Boolean(constants.API && constants.API.REST_FALLBACK_ENABLED);

    let products = [];
    let dedupeSet = new Set();
    let status = 'idle';
    let activeSearch = null;
    let searchTimeout = null;
    let listeners = [];
    let fallbackInProgress = false;

    client.configure({
      onConnect: () => {
        updateStatus('searching');
        if (activeSearch) {
          client.sendSearch(activeSearch.payload);
        }
      },
      onDisconnect: async () => {
        if (!activeSearch) {
          return;
        }
        if (restFallbackEnabled) {
          await runFallback('WebSocket disconnected');
          return;
        }
        updateStatus('connecting');
        emit({ reason: 'WebSocket disconnected. Reintentando conexion...' });
      },
      onProducts: handleProduct,
      onErrors: handleError,
      onTransportError: async () => {
        if (!activeSearch) {
          return;
        }
        if (restFallbackEnabled) {
          await runFallback('Transport error');
          return;
        }
        updateStatus('connecting');
        emit({ reason: 'Transport error. Reintentando conexion...' });
      },
    });

    async function startSearch(input) {
      const query = (input.query || '').trim();
      if (!query) {
        throw new Error('La query es obligatoria');
      }

      clearCurrentSearch();
      updateStatus('connecting');

      const payload = { query };

      if (Array.isArray(input.sources) && input.sources.length > 0) {
        payload.sources = input.sources;
      }

      if (input.searchId) {
        payload.search_id = input.searchId;
      }

      activeSearch = {
        productRef: input.productRef || null,
        query,
        payload,
      };

      startSearchTimeout();
      client.connect(buildConnectHeaders());
      emit();
    }

    function stopSearch() {
      clearSearchTimeout();
      client.disconnect();
      updateStatus('completed');
      emit();
    }

    function subscribe(listener) {
      listeners.push(listener);
      listener(getState());
      return () => {
        listeners = listeners.filter((entry) => entry !== listener);
      };
    }

    function getState() {
      return {
        status,
        products: [...products],
        activeSearch,
        fallbackInProgress,
      };
    }

    function handleProduct(payload) {
      if (!domainContracts.isValidNormalizedProductDto(payload)) {
        return;
      }

      const domainProduct = domainContracts.toDomainProduct(payload);
      if (domainProduct.productRef && activeSearch) {
        activeSearch.productRef = domainProduct.productRef;
      }
      const dedupeKey = domainContracts.buildDedupeKey(domainProduct);
      if (dedupeSet.has(dedupeKey)) {
        return;
      }
      dedupeSet.add(dedupeKey);

      products.push(domainProduct);
      products = products.sort((a, b) => a.price - b.price);

      clearSearchTimeout();
      startSearchTimeout();
      updateStatus('streaming');
      emit();
    }

    async function handleError(payload) {
      if (!domainContracts.isValidExceptionDto(payload)) {
        return;
      }

      const event = domainContracts.toDomainException(payload);
      if (event.productRef && activeSearch) {
        activeSearch.productRef = event.productRef;
      }

      if (event.code === 'PRODUCT_IN_BD') {
        await runFallback('Producto existente en BD');
        updateStatus('completed');
        emit({ event });
        return;
      }

      updateStatus('error');
      clearSearchTimeout();
      emit({ event });
    }

    async function runFallback(reason) {
      if (!restFallbackEnabled || fallbackInProgress || !activeSearch) {
        return;
      }

      const fallbackProductRef = getFallbackProductRef();
      if (!fallbackProductRef) {
        updateStatus('error');
        emit({ reason, error: 'No hay product_ref para fallback REST' });
        return;
      }

      fallbackInProgress = true;
      emit();
      try {
        const restoredProducts = await pricingService.restoreByProductRef(fallbackProductRef, activeSearch.query);
        for (const product of restoredProducts) {
          const dedupeKey = domainContracts.buildDedupeKey(product);
          if (dedupeSet.has(dedupeKey)) {
            continue;
          }
          dedupeSet.add(dedupeKey);
          products.push(product);
        }
        products = products.sort((a, b) => a.price - b.price);
        updateStatus(products.length ? 'completed' : 'error');
        emit({ reason });
      } catch (error) {
        updateStatus('error');
        emit({ reason, error: error.message });
      } finally {
        fallbackInProgress = false;
        emit();
      }
    }

    function startSearchTimeout() {
      clearSearchTimeout();
      searchTimeout = global.setTimeout(async () => {
        if (status === 'completed' || status === 'error') {
          return;
        }
        if (!restFallbackEnabled) {
          updateStatus(products.length ? 'completed' : 'error');
          emit({ reason: 'Search timeout sin fallback REST habilitado' });
          return;
        }
        await runFallback('Search timeout');
      }, constants.SEARCH.TIMEOUT_MS);
    }

    function getFallbackProductRef() {
      if (activeSearch?.productRef) {
        return activeSearch.productRef;
      }
      if (!products.length) {
        return null;
      }
      return products[0].productRef || null;
    }

    function clearSearchTimeout() {
      if (!searchTimeout) {
        return;
      }
      clearTimeout(searchTimeout);
      searchTimeout = null;
    }

    function clearCurrentSearch() {
      clearSearchTimeout();
      client.disconnect();
      products = [];
      dedupeSet = new Set();
      status = 'idle';
      activeSearch = null;
      fallbackInProgress = false;
    }

    function updateStatus(nextStatus) {
      status = nextStatus;
    }

    function emit(meta) {
      const snapshot = {
        ...getState(),
        meta: meta || null,
      };
      listeners.forEach((listener) => {
        try {
          listener(snapshot);
        } catch (error) {
          console.error(`${constants.LOG_PREFIX} Error en listener de workflow:`, error);
        }
      });
    }

    function buildConnectHeaders() {
      const headers = {};
      if (constants.WS.AUTH_TOKEN) {
        headers.Authorization = `Bearer ${constants.WS.AUTH_TOKEN}`;
      }
      return headers;
    }

    return {
      startSearch,
      stopSearch,
      subscribe,
      getState,
      runFallback,
    };
  }

  PriceTracker.searchWorkflowFactory = {
    createWorkflow,
  };
})(window);
