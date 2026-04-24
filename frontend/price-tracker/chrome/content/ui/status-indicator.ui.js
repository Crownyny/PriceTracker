(function initStatusIndicatorUi(global) {
  const PriceTracker = (global.PriceTracker = global.PriceTracker || {});

  const STATUS_ID = 'price-tracker-status';

  function show(onDisable) {
    if (document.getElementById(STATUS_ID)) {
      return;
    }

    const indicator = document.createElement('div');
    indicator.id = STATUS_ID;
    indicator.className = 'price-tracker-status-indicator';
    indicator.innerHTML = `
      <div class="status-icon">⚡</div>
      <div class="status-text">
        <span class="status-title">PriceTracker</span>
        <span class="status-label active">Activado</span>
      </div>
      <div class="status-toggle" id="status-toggle"></div>
    `;

    document.body.appendChild(indicator);

    const toggle = indicator.querySelector('#status-toggle');
    if (toggle) {
      toggle.addEventListener('click', onDisable);
    }
  }

  function hide() {
    const indicator = document.getElementById(STATUS_ID);
    if (indicator) {
      indicator.remove();
    }
  }

  PriceTracker.statusIndicatorUi = {
    show,
    hide,
  };
})(window);
