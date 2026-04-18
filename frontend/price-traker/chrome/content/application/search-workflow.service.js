(function initSearchWorkflow(global) {
  const PriceTracker = (global.PriceTracker = global.PriceTracker || {});
  const { constants, domainContracts, pricingService, stompSockJsClientFactory } = PriceTracker;

  if (!constants) {
    console.error('[SEARCH WORKFLOW] Constants not available');
    return;
  }

  function createWorkflow() {
    // Get StatusTracker lazily - it should be loaded by now
    const statusMessages = PriceTracker.statusMessages || {};
    const statusTracker = statusMessages.createStatusTracker ? statusMessages.createStatusTracker() : null;
    
    const client = stompSockJsClientFactory.createClient();
    const restFallbackEnabled = Boolean(constants.API && constants.API.REST_FALLBACK_ENABLED);

    let products = [];
    let dedupeSet = new Set();
    let status = 'idle';
    let activeSearch = null;
    let searchTimeout = null;
    let listeners = [];
    let fallbackInProgress = false;
    let backendStatus = null;
    let expectedDisconnect = false; // Flag for graceful disconnections (e.g., PRODUCT_IN_BD)
    let intentCheckPending = false;
    let searchTimestamp = null; // Timestamp para cache expiry de 20 minutos
    
    // Buffering: don't emit on every product, batch updates
    let statusUpdateInterval = null;
    let renderTimeout = null;
    let pendingRender = false;
    const minProductsBeforeShow = 15; // Wait for at least 15 products before showing table
    const RENDER_BATCH_DELAY = 500;
    const CACHE_EXPIRY_MS = 20 * 60 * 1000; // 20 minutos en ms
    
    // Helper: Generate UUID for search_id
    function generateSearchId() {
      return 'search_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    // Helper: Checkea si el cache ha expirado (20 minutos)
    function isCacheExpired() {
      if (!searchTimestamp) {
        return false; // Sin timestamp conocido, cache no expira
      }
      const now = Date.now();
      const elapsedMs = now - searchTimestamp;
      const isExpired = elapsedMs > CACHE_EXPIRY_MS;
      if (isExpired) {
        console.log(`${constants.LOG_PREFIX} [CACHE] Cache expired: ${elapsedMs}ms > ${CACHE_EXPIRY_MS}ms`);
      }
      return isExpired;
    }
    
    // Call /api/intent/intent to check if query is a purchase intent
    // NOTE: This is best-effort; failures don't block the search
    async function checkPurchaseIntent(query) {
      if (intentCheckPending) {
        console.log(`${constants.LOG_PREFIX} [INTENT] Already pending, skipping duplicate check`);
        return true;
      }
      
      try {
        intentCheckPending = true;
        const apiUrl = `${constants.API?.BASE_URL || 'http://localhost:8080'}/api/intent/intent`;
        console.log(`${constants.LOG_PREFIX} [INTENT] Checking query...`);
        
        // Short timeout to not block search
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
        
        try {
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const result = await response.json();
            const isBuyIntent = result.label === 'BUY';
            console.log(`${constants.LOG_PREFIX} [INTENT] ${isBuyIntent ? '✓ BUY' : '✗ NOT_BUY'}`);
            return isBuyIntent;
          } else {
            console.log(`${constants.LOG_PREFIX} [INTENT] API ${response.status}, proceeding anyway`);
            return true;
          }
        } catch (err) {
          clearTimeout(timeoutId);
          
          if (err.name === 'AbortError') {
            console.log(`${constants.LOG_PREFIX} [INTENT] Timeout, proceeding`);
          } else {
            console.log(`${constants.LOG_PREFIX} [INTENT] ${err.message}, proceeding`);
          }
          return true;
        }
      } catch (error) {
        console.log(`${constants.LOG_PREFIX} [INTENT] Unexpected error, proceeding:`, error.message);
        return true;
      } finally {
        intentCheckPending = false;
      }
    }

    function startStatusUpdateTimer() {
      // Update status message every second so "delayed" message appears after 6 seconds
      if (statusUpdateInterval) {
        clearInterval(statusUpdateInterval);
      }
      
      statusUpdateInterval = setInterval(() => {
        if (status === 'searching' || status === 'streaming') {
          // Just emit to trigger UI update with new elapsed time
          emit();
        }
      }, 1000);
    }

    function clearStatusUpdateInterval() {
      if (statusUpdateInterval) {
        clearInterval(statusUpdateInterval);
        statusUpdateInterval = null;
      }
    }

    // Definir todas las funciones handlers ANTES de usarlas en client.configure
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
      if (statusTracker && statusTracker.recordProductReceived) {
        statusTracker.recordProductReceived();
      }

      // Mark future disconnections as expected - we got data
      expectedDisconnect = true;

      clearSearchTimeout();
      startSearchTimeout();
      updateStatus('streaming');
      
      // Schedule render with debounce instead of immediate emit
      scheduleRender();
    }
    
    function scheduleRender() {
      if (pendingRender) {
        return; // Already scheduled
      }
      
      pendingRender = true;
      
      // Only render if:
      // 1. We have enough products (>= minProductsBeforeShow) AND we're in a stable state, OR
      // 2. We're completed (show final results even if < 5 products)
      const hasEnoughProducts = products.length >= minProductsBeforeShow;
      const isStableForRender = status === 'completed' || (status === 'streaming' && hasEnoughProducts);
      
      const shouldRender = isStableForRender;
      
      if (renderTimeout) {
        clearTimeout(renderTimeout);
      }
      
      renderTimeout = setTimeout(() => {
        pendingRender = false;
        if (shouldRender) {
          emit();
        }
      }, RENDER_BATCH_DELAY);
    }

    async function handleError(payload) {
      console.log(`${constants.LOG_PREFIX} [HANDLER] handleError received:`, payload);
      
      if (!domainContracts.isValidExceptionDto(payload)) {
        console.warn(`${constants.LOG_PREFIX} [HANDLER] Invalid ExceptionDTO`);
        return;
      }

      const event = domainContracts.toDomainException(payload);
      console.log(`${constants.LOG_PREFIX} [HANDLER] Parsed exception:`, event);
      
      if (event.productRef && activeSearch) {
        activeSearch.productRef = event.productRef;
      }

      if (event.code === 'PRODUCT_IN_BD') {
        // Checkea si el cache ha expirado (20 minutos)
        if (isCacheExpired()) {
          console.log(`${constants.LOG_PREFIX} [HANDLER] ⏰ Cache EXPIRED (>20 min) - ignoring PRODUCT_IN_BD, continuing search...`);
          // Continúa con búsqueda normal, no usa cache
        } else {
          console.log(`${constants.LOG_PREFIX} [HANDLER] ✓ PRODUCT_IN_BD detected - loading cached products`);
          // Búsqueda existe en BD - traer resultados guardados
          expectedDisconnect = true; // Mark disconnect as expected
          
          if (statusTracker && statusTracker.setBackendPhase) {
            statusTracker.setBackendPhase('cached');
          }
          
          if (statusTracker && statusTracker.setStatus) {
            statusTracker.setStatus('streaming');
          }
          
          await fetchCachedProducts(event.productRef);
          updateStatus('completed');
          emit({ event });
          return;
        }
      }

      // BACKEND ERROR: Close WebSocket and immediately fallback to REST
      console.log(`${constants.LOG_PREFIX} [HANDLER] ❌ Backend sent error: ${event.code || 'UNKNOWN'}`);
      console.log(`${constants.LOG_PREFIX} [HANDLER] 📋 Error details:`, event);
      console.log(`${constants.LOG_PREFIX} [HANDLER] ✓ Triggering immediate REST fallback...`);
      expectedDisconnect = true; // Mark as expected
      clearSearchTimeout();
      
      // Close WebSocket first
      client.disconnect();
      
      // Wait a tiny bit for disconnect to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Immediately try REST fallback
      if (restFallbackEnabled && activeSearch) {
        await runFallback(`Backend error: ${event.code}`);
      } else {
        console.log(`${constants.LOG_PREFIX} [HANDLER] ✗ Cannot fallback - restEnabled=${restFallbackEnabled}, activeSearch=${!!activeSearch}`);
        updateStatus('error');
        emit({ event });
      }
    }

    async function fetchCachedProducts(productRef) {
      try {
        const apiUrl = `${constants.API?.BASE_URL || 'http://localhost:8080'}/api/products/search`;
        console.log(`${constants.LOG_PREFIX} [CACHE] Fetching cached products for ref: ${productRef}`);
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_ref: productRef }),
        });

        if (!response.ok) {
          console.error(`${constants.LOG_PREFIX} [CACHE] API error ${response.status}: ${response.statusText}`);
          return;
        }

        const cachedProducts = await response.json();
        console.log(`${constants.LOG_PREFIX} [CACHE] Received ${Array.isArray(cachedProducts) ? cachedProducts.length : '?'} products`);
        
        if (!Array.isArray(cachedProducts)) {
          console.warn(`${constants.LOG_PREFIX} [CACHE] Expected array of products, got:`, cachedProducts);
          return;
        }

        if (cachedProducts.length === 0) {
          console.warn(`${constants.LOG_PREFIX} [CACHE] No products returned from cache`);
          return;
        }

        // Process each product
        console.log(`${constants.LOG_PREFIX} [CACHE] Processing ${cachedProducts.length} cached products...`);
        for (const productPayload of cachedProducts) {
          handleProduct(productPayload);
        }
        console.log(`${constants.LOG_PREFIX} [CACHE] ✓ Loaded ${products.length} total products after cache`);
        
        // Immediately render cached products without waiting for batch delay
        if (products.length > 0) {
          console.log(`${constants.LOG_PREFIX} [CACHE] Emitting ${products.length} cached products immediately`);
          emit();
        }
      } catch (error) {
        console.error(`${constants.LOG_PREFIX} [CACHE] Error:`, error.message);
      }
    }

    function handleStatus(payload) {
      if (!domainContracts.isValidSearchStatusDto(payload)) {
        return;
      }

      backendStatus = {
        searchId: payload.search_id,
        productRef: payload.product_ref,
        totalNormalized: payload.total_normalized,
        completedAt: payload.completed_at,
      };

      console.log(`${constants.LOG_PREFIX} [STATUS] total_normalized: ${payload.total_normalized}`);

      // Map backend status to UI phase based on the data
      if (statusTracker && statusTracker.setBackendPhase) {
        if (payload.total_normalized && payload.total_normalized > 0) {
          // Update with product count for progress display
          if (statusTracker.setProductCount) {
            statusTracker.setProductCount(payload.total_normalized);
          }
          statusTracker.setBackendPhase('normalizing');
        } else if (payload.search_id) {
          statusTracker.setBackendPhase('scraping');
        }
      }

      clearSearchTimeout();
      startSearchTimeout();
      scheduleRender();
    }

    // Configurar el cliente DESPUÉS de definir los handlers
    client.configure({
      onConnect: () => {
        updateStatus('searching');
        if (activeSearch) {
          try {
            client.sendSearch(activeSearch.payload);
          } catch (error) {
            console.error(`${constants.LOG_PREFIX} Error enviando búsqueda en onConnect:`, error);
            if (restFallbackEnabled) {
              runFallback('Error enviando búsqueda');
            } else {
              updateStatus('error');
              emit({ error: error.message });
            }
          }
        }
      },
      onDisconnect: async () => {
        if (!activeSearch) {
          console.log(`${constants.LOG_PREFIX} [HANDLERS] onDisconnect: no activeSearch`);
          return;
        }
        
        // If this is an expected disconnect (e.g., PRODUCT_IN_BD), don't treat as error
        if (expectedDisconnect) {
          console.log(`${constants.LOG_PREFIX} [HANDLERS] Expected disconnect (cached search)`);
          expectedDisconnect = false;
          return;
        }
        
        // If we already received products, this is a normal completion
        if (products.length > 0) {
          console.log(`${constants.LOG_PREFIX} [HANDLERS] Disconnect after receiving ${products.length} products - normal completion`);
          updateStatus('completed');
          emit();
          return;
        }
        
        // Give a small delay in case error/status messages are still being processed
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check again - might have been set by error handler
        if (expectedDisconnect) {
          console.log(`${constants.LOG_PREFIX} [HANDLERS] Expected disconnect detected on retry`);
          expectedDisconnect = false;
          return;
        }
        
        // If still no products, try fallback
        console.log(`${constants.LOG_PREFIX} [HANDLERS] Unexpected disconnect with no products, triggering fallback`);
        if (restFallbackEnabled) {
          await runFallback('WebSocket disconnected');
          return;
        }
        updateStatus('connecting');
        emit({ reason: 'WebSocket disconnected. Reintentando conexion...' });
      },
      onProducts: handleProduct,
      onErrors: handleError,
      onStatus: handleStatus,
      onTransportError: async () => {
        if (!activeSearch) {
          console.log(`${constants.LOG_PREFIX} [HANDLERS] onTransportError: no activeSearch`);
          return;
        }
        
        // If search just started, don't immediately treat as error - might still connecting
        if (status === 'connecting' || status === 'searching') {
          console.log(`${constants.LOG_PREFIX} [HANDLERS] onTransportError during initial connection, waiting...`);
          await new Promise(resolve => setTimeout(resolve, 500));
          // Check if now we have data or error was resolved
          if (products.length > 0 || status === 'completed') {
            return;
          }
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

      // FIRST: Immediately clear ALL state from previous search
      console.log(`${constants.LOG_PREFIX} [SEARCH] Starting new search, clearing old state...`);
      products = [];
      dedupeSet = new Set();
      status = 'idle';
      fallbackInProgress = false;
      expectedDisconnect = false;
      searchTimestamp = Date.now(); // Inicia conteo de 20 minutos para cache
      if (statusTracker && statusTracker.reset) {
        statusTracker.reset();
      }

      // SECOND: Disconnect previous connection
      if (activeSearch) {
        console.log(`${constants.LOG_PREFIX} [SEARCH] Closing previous WebSocket...`);
        client.disconnect();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Clear remaining state
      clearCurrentSearch();
      updateStatus('connecting');

      // Check purchase intent BEFORE proceeding with search
      try {
        const isBuyIntent = await checkPurchaseIntent(query);
        console.log(`${constants.LOG_PREFIX} [SEARCH] Intent check result: ${isBuyIntent ? '✓ BUY' : '✗ NOT_BUY'}`);
        console.log(`${constants.LOG_PREFIX} [SEARCH] isBuyIntent value:`, isBuyIntent, `| type:`, typeof isBuyIntent);
        
        if (!isBuyIntent) {
          console.log(`${constants.LOG_PREFIX} [SEARCH] NO PURCHASE INTENT DETECTED - Extension will not be shown`);
          console.log(`${constants.LOG_PREFIX} [SEARCH] Query: "${query}"`);
          console.log(`${constants.LOG_PREFIX} [SEARCH] Stopping search now...`);
          updateStatus('idle');
          emit();
          return;
        }
        console.log(`${constants.LOG_PREFIX} [SEARCH] Purchase intent confirmed - proceeding with search`);
      } catch (err) {
        console.error(`${constants.LOG_PREFIX} [SEARCH] Intent check FAILED:`, err.message);
        console.log(`${constants.LOG_PREFIX} [SEARCH] Continuing anyway due to error...`);
        // Continue anyway if intent check fails
      }

      // STEP 1: Generate search_id (frontend responsibility)
      const searchId = generateSearchId();
      console.log(`${constants.LOG_PREFIX} [SEARCH] Generated search_id: ${searchId}`);

      // STEP 2: Build minimal payload - let backend generate productRef
      // Backend expects snake_case format and generates productRef from query
      const payload = { 
        query,
        search_id: searchId,
      };

      if (Array.isArray(input.sources) && input.sources.length > 0) {
        payload.sources = input.sources;
      }

      activeSearch = {
        searchId,
        productRef: null,  // Backend will provide this in responses
        query,
        payload,
      };

      console.log(`${constants.LOG_PREFIX} [SEARCH] Final payload:`, payload);

      startStatusUpdateTimer();
      startSearchTimeout();
      
      // FIRST: Check if product already exists in backend (via background worker)
      const productRef = activeSearch.query.replaceAll(" ", "");
      const existsInBackend = await checkIfProductExistsViaBackground(productRef);
      
      if (existsInBackend) {
        // Product exists → go directly to REST, skip WebSocket
        console.log(`${constants.LOG_PREFIX} [SEARCH] ✓ Product exists in backend, using REST directly`);
        await runFallback('Product cached in backend');
        return;
      }
      
      // Product doesn't exist → use normal WebSocket flow
      client.connect(buildConnectHeaders());
      emit();
    }

    function checkIfProductExistsViaBackground(productRef) {
      return new Promise((resolve) => {
        console.log(`${constants.LOG_PREFIX} [CHECK] Checking if product exists via background: ${productRef}`);
        
        const messageListener = (message) => {
          if (message.type === 'ws-relay-check-product-response') {
            chrome.runtime.onMessage.removeListener(messageListener);
            clearTimeout(timeoutId);
            const exists = message.data?.exists || false;
            console.log(`${constants.LOG_PREFIX} [CHECK] Product ${exists ? 'EXISTS' : 'NOT FOUND'} in backend`);
            resolve(exists);
            return;
          }
        };

        chrome.runtime.onMessage.addListener(messageListener);

        // Send request to background worker
        chrome.runtime.sendMessage({
          type: 'ws-relay-check-product',
          productRef: productRef,
        });

        // Timeout in case background doesn't respond
        const timeoutId = setTimeout(() => {
          chrome.runtime.onMessage.removeListener(messageListener);
          console.log(`${constants.LOG_PREFIX} [CHECK] Check timeout, proceeding with WebSocket`);
          resolve(false); // Default to WebSocket on timeout
        }, 3000);
      });
    }

    function stopSearch() {
      clearSearchTimeout();
      clearStatusUpdateInterval();
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
      // Only show products if we have at least minProductsBeforeShow (15) OR search is completed with fewer
      // This ensures spinner/loading messages show until we have a meaningful dataset
      const shouldShowProducts = products.length >= minProductsBeforeShow || status === 'completed';
      const productsToReturn = shouldShowProducts ? [...products] : [];
      
      return {
        status,
        products: productsToReturn,
        activeSearch,
        fallbackInProgress,
        backendStatus,
        statusMessage: statusTracker && statusTracker.getCurrentMessage ? statusTracker.getCurrentMessage() : null,
        elapsedTime: statusTracker && statusTracker.getElapsedTime ? statusTracker.getElapsedTime() : 0,
      };
    }

    function emitStatusOnly() {
      // Emit status updates immediately without batching (for UI message updates)
      // Only include statusMessage, not products yet
      const stateWithoutProducts = {
        status,
        products: [], // Don't include products in status-only updates
        activeSearch,
        fallbackInProgress,
        backendStatus,
        statusMessage: statusTracker && statusTracker.getCurrentMessage ? statusTracker.getCurrentMessage() : null,
        elapsedTime: statusTracker && statusTracker.getElapsedTime ? statusTracker.getElapsedTime() : 0,
      };
      listeners.forEach(listener => listener(stateWithoutProducts));
    }

    async function runFallback(reason) {
      // Don't fallback if we already have products - disconnection is normal
      if (products.length > 0) {
        console.log(`${constants.LOG_PREFIX} [FALLBACK] Already have ${products.length} products, skipping fallback`);
        return;
      }

      if (!restFallbackEnabled || fallbackInProgress || !activeSearch) {
        console.log(`${constants.LOG_PREFIX} [FALLBACK] Conditions not met: restEnabled=${restFallbackEnabled}, inProgress=${fallbackInProgress}, activeSearch=${!!activeSearch}`);
        return;
      }

      const fallbackProductRef = getFallbackProductRef();
      if (!fallbackProductRef) {
        console.log(`${constants.LOG_PREFIX} [FALLBACK] ✗ No product_ref available for fallback`);
        updateStatus('error');
        emit({ reason, error: 'No hay product_ref para fallback REST' });
        return;
      }

      console.log(`${constants.LOG_PREFIX} [FALLBACK] ✓ Starting REST fallback`);
      console.log(`${constants.LOG_PREFIX} [FALLBACK]   Product Ref: "${fallbackProductRef}"`);
      console.log(`${constants.LOG_PREFIX} [FALLBACK]   Query: "${activeSearch.query}"`);
      console.log(`${constants.LOG_PREFIX} [FALLBACK]   Reason: ${reason}`);
      
      fallbackInProgress = true;
      updateStatus('fetching-rest'); // Show we're fetching from REST backend
      emitStatusOnly(); // Show status message immediately, no products yet
      
      try {
        const restoredProducts = await pricingService.restoreByProductRef(fallbackProductRef, activeSearch.query);
        console.log(`${constants.LOG_PREFIX} [FALLBACK] REST returned ${restoredProducts.length} products`);
        
        for (const product of restoredProducts) {
          const dedupeKey = domainContracts.buildDedupeKey(product);
          if (dedupeSet.has(dedupeKey)) {
            continue;
          }
          dedupeSet.add(dedupeKey);
          products.push(product);
        }
        products = products.sort((a, b) => a.price - b.price);
        
        // Show progressive status updates even with REST
        if (statusTracker && statusTracker.setProductCount) {
          statusTracker.setProductCount(products.length);
        }
        
        if (statusTracker && statusTracker.setBackendPhase) {
          statusTracker.setBackendPhase('normalizing');
        }
        updateStatus('streaming');
        emitStatusOnly(); // Show "Normalizando..." message, no products yet
        
        // Simulate normalization delay (2 seconds)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (statusTracker && statusTracker.setBackendPhase) {
          statusTracker.setBackendPhase('comparing');
        }
        updateStatus('streaming');
        emitStatusOnly(); // Show "Creando tabla..." message, no products yet
        
        // Simulate comparison delay (1 second)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        updateStatus('completed');
        scheduleRender(); // Now render with all products if >= 20
      } catch (error) {
        console.error(`${constants.LOG_PREFIX} [FALLBACK] ❌ Fallback failed:`, error.message);
        updateStatus('error');
        emitStatusOnly();
      } finally {
        fallbackInProgress = false;
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
      // If we have products from a previous search, use their productRef
      if (products.length > 0) {
        return products[0].productRef || null;
      }
      // Generate productRef from current query (same as backend would do)
      if (activeSearch?.query) {
        return activeSearch.query.replaceAll(" ", "");
      }
      return null;
    }

    function clearSearchTimeout() {
      if (!searchTimeout) {
        return;
      }
      clearTimeout(searchTimeout);
      searchTimeout = null;
    }

    function clearCurrentSearch() {
      // Timeouts and intervals already cleared by startSearch
      clearSearchTimeout();
      clearStatusUpdateInterval();
      if (renderTimeout) {
        clearTimeout(renderTimeout);
        renderTimeout = null;
        pendingRender = false;
      }
      // Note: activeSearch is set to null in startSearch after initial cleanup
      // Just ensure activeSearch is cleared
      activeSearch = null;
    }

    function updateStatus(nextStatus) {
      status = nextStatus;
      if (statusTracker && statusTracker.setStatus) {
        statusTracker.setStatus(nextStatus);
      }
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
