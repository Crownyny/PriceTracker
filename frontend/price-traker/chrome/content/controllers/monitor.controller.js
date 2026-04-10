(function initMonitorController(global) {
  const PriceTracker = (global.PriceTracker = global.PriceTracker || {});
  const {
    constants,
    state,
    googleSearchPage,
    statusIndicatorUi,
    overlayUi,
    searchWorkflowFactory,
    searchPanelPresenter,
  } = PriceTracker;

  const workflow = searchWorkflowFactory.createWorkflow();
  let workflowUnsubscribe = null;
  let visibilityHandlersBound = false;
  let renderTimer = null;
  let latestWorkflowState = null;
  let overlayManuallyClosed = false;  // Flag para marcar si fue cerrado manualmente

  function start() {
    if (state.monitoringActive) {
      return;
    }

    state.monitoringActive = true;
    log('Iniciando monitoreo');

    statusIndicatorUi.show(handleDisableFromIndicator);
    bindWorkflow();
    processCurrentPage();
    startUrlObserver();
    bindVisibilityRefresh();
  }

  function stop() {
    if (!state.monitoringActive) {
      return;
    }

    state.monitoringActive = false;

    stopUrlObserver();
    unbindWorkflow();
    workflow.stopSearch();
    statusIndicatorUi.hide();
    overlayUi.remove();
    removeMinimizedTab();
    clearRenderTimer();
    latestWorkflowState = null;
    state.overlayInjected = false;
    state.currentQuery = null;
    overlayManuallyClosed = false;

    log('Monitoreo detenido');
  }

  async function processCurrentPage() {
    if (!googleSearchPage.isSearchResultsPage()) {
      overlayUi.remove();
      removeMinimizedTab();
      state.overlayInjected = false;
      state.currentQuery = null;
      workflow.stopSearch();
      return;
    }

    const query = googleSearchPage.getQueryFromLocation();
    if (!query) {
      return;
    }

    if (query === state.currentQuery) {
      return;
    }

    state.currentQuery = query;
    overlayManuallyClosed = false;  // Reset cuando hay nueva búsqueda
    removeMinimizedTab();
    try {
      await workflow.startSearch({
        query,
      });
    } catch (error) {
      console.error(`${constants.LOG_PREFIX} Error iniciando busqueda:`, error);
    }
  }

  function startUrlObserver() {
    if (state.urlObserver) {
      return;
    }

    let lastUrl = window.location.href;

    state.urlObserver = new MutationObserver(async () => {
      const currentUrl = window.location.href;
      if (currentUrl === lastUrl) {
        return;
      }

      lastUrl = currentUrl;
      log(`URL cambio a: ${currentUrl}`);
      await processCurrentPage();
    });

    state.urlObserver.observe(document.body, { childList: true, subtree: true });
  }

  function stopUrlObserver() {
    if (!state.urlObserver) {
      return;
    }

    state.urlObserver.disconnect();
    state.urlObserver = null;
  }

  function bindVisibilityRefresh() {
    if (visibilityHandlersBound) {
      return;
    }

    document.addEventListener('visibilitychange', async () => {
      if (!state.monitoringActive || document.visibilityState !== 'visible') {
        return;
      }
      await workflow.runFallback('visibility-refresh');
    });

    window.addEventListener('focus', async () => {
      if (!state.monitoringActive) {
        return;
      }
      await workflow.runFallback('focus-refresh');
    });

    visibilityHandlersBound = true;
  }

  async function handleDisableFromIndicator() {
    await chrome.storage.local.set({ [constants.STORAGE_KEYS.EXTENSION_ACTIVE]: false });
    stop();
  }

  function bindWorkflow() {
    if (workflowUnsubscribe) {
      return;
    }

    workflowUnsubscribe = workflow.subscribe((workflowState) => {
      scheduleRender(workflowState);
    });
  }

  function unbindWorkflow() {
    if (!workflowUnsubscribe) {
      return;
    }

    workflowUnsubscribe();
    workflowUnsubscribe = null;
    clearRenderTimer();
  }

  function scheduleRender(workflowState) {
    latestWorkflowState = workflowState;
    if (renderTimer) {
      return;
    }

    const waitMs = Number(constants.UI?.RENDER_DEBOUNCE_MS || 250);
    renderTimer = window.setTimeout(() => {
      renderTimer = null;
      if (latestWorkflowState) {
        renderFromWorkflow(latestWorkflowState);
      }
    }, waitMs);
  }

  function clearRenderTimer() {
    if (!renderTimer) {
      return;
    }
    clearTimeout(renderTimer);
    renderTimer = null;
  }

  function renderFromWorkflow(workflowState) {
    // Si fue cerrado manualmente, no volver a renderizar hasta que se reabra
    if (overlayManuallyClosed) {
      console.log(`${constants.LOG_PREFIX} Overlay cerrado manualmente - no renderizando`);
      return;
    }

    if (!workflowState.activeSearch && workflowState.products.length === 0) {
      overlayUi.remove();
      state.overlayInjected = false;
      return;
    }

    const data = searchPanelPresenter.toOverlayData(workflowState);
    const message = searchPanelPresenter.statusMessage(workflowState.status);
    const anchor = googleSearchPage.findInsertAnchor();

    overlayUi.show(data, {
      insertAnchor: anchor,
      stateMessage: message,
      onClose: () => {
        overlayUi.remove();
        overlayManuallyClosed = true;  // Marcar como cerrado manualmente
        workflow.stopSearch();
        state.overlayInjected = false;
        showMinimizedTab();  // Mostrar pestaña flotante
        console.log(`${constants.LOG_PREFIX} Extensión cerrada manualmente - mostrando pestaña mínima`);
      },
      onOpenDashboard: () => {
        chrome.runtime.sendMessage({ type: constants.MESSAGE_TYPES.OPEN_DASHBOARD });
      },
    });

    state.overlayInjected = true;
  }

  function showMinimizedTab() {
    // Pestaña flotante para reabrir
    let minimized = document.getElementById('price-tracker-minimized-tab');
    if (!minimized) {
      minimized = document.createElement('div');
      minimized.id = 'price-tracker-minimized-tab';
      minimized.innerHTML = `
        <div class="price-tracker-minimized-button">
          <span class="price-tracker-minimized-text">💰 PriceTracker</span>
        </div>
      `;
      document.body.appendChild(minimized);

      minimized.addEventListener('click', () => {
        minimized.remove();
        overlayManuallyClosed = false;  // Marcar como reabierto
        if (latestWorkflowState) {
          renderFromWorkflow(latestWorkflowState);
        }
      });
    }
  }

  function removeMinimizedTab() {
    const minimized = document.getElementById('price-tracker-minimized-tab');
    if (minimized) {
      minimized.remove();
    }
  }

  function log(message) {
    console.log(`${constants.LOG_PREFIX} ${message}`);
  }

  PriceTracker.monitorController = {
    start,
    stop,
    processCurrentPage,
  };
})(window);
