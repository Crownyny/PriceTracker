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
    state.overlayInjected = false;
    state.currentQuery = null;

    log('Monitoreo detenido');
  }

  async function processCurrentPage() {
    if (!googleSearchPage.isSearchResultsPage()) {
      overlayUi.remove();
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
    try {
      await workflow.startSearch({
        query,
        sources: constants.SEARCH.DEFAULT_SOURCES,
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
      renderFromWorkflow(workflowState);
    });
  }

  function unbindWorkflow() {
    if (!workflowUnsubscribe) {
      return;
    }

    workflowUnsubscribe();
    workflowUnsubscribe = null;
  }

  function renderFromWorkflow(workflowState) {
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
        workflow.stopSearch();
        state.overlayInjected = false;
      },
      onOpenDashboard: () => {
        chrome.runtime.sendMessage({ type: constants.MESSAGE_TYPES.OPEN_DASHBOARD });
      },
    });

    state.overlayInjected = true;
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
