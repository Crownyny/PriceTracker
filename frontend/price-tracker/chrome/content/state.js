(function initState(global) {
  const PriceTracker = (global.PriceTracker = global.PriceTracker || {});

  PriceTracker.state = {
    extensionActive: false,
    monitoringActive: false,
    overlayInjected: false,
    currentQuery: null,
    urlObserver: null,
    refreshTimer: null,
  };
})(window);
