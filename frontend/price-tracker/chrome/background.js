// Background Service Worker para la extensión
importScripts('vendor/sockjs.min.js', 'vendor/stomp.umd.min.js', 'setup-dev-config.js', 'dashboard-config.js', 'background/ws-relay.js', 'background/api-relay-handler.js');

let extensionActive = false;

hydrateExtensionState();

async function hydrateExtensionState() {
  try {
    const result = await chrome.storage.local.get(['extensionActive']);
    extensionActive = result.extensionActive ?? false;
    await setupDevConfig();
  } catch (error) {
    console.error('Error cargando estado inicial:', error);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(['extensionActive']);
  await chrome.storage.local.set({
    extensionActive: current.extensionActive ?? false
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // API_REQUEST es manejado por api-relay-handler.js
  if (message.type === 'API_REQUEST') {
    return true;
  }

  switch (message.type) {
    case 'TOGGLE_EXTENSION':
      handleToggleExtension(message.active)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'GET_EXTENSION_STATE':
      sendResponse({ active: extensionActive });
      break;

    case 'OPEN_DASHBOARD':
      (async () => {
        const baseDashboardUrl = (globalThis.PriceTracker?.dashboardConfigManager?.getDashboardUrl)
          ? await globalThis.PriceTracker.dashboardConfigManager.getDashboardUrl()
          : 'http://localhost:4200/dashboard';

        const deepLinkUrl = buildDashboardDeepLink(baseDashboardUrl, {
          productRef: message.productRef,
          query: message.query,
        });

        return chrome.tabs.create({ url: deepLinkUrl })
          .then(() => sendResponse({ success: true }))
          .catch(error => sendResponse({ success: false, error: error.message }));
      })();
      return true;

    default:
      sendResponse({ success: false, error: 'Tipo de mensaje desconocido' });
  }
});

function buildDashboardDeepLink(baseDashboardUrl, payload) {
  try {
    const url = new URL(baseDashboardUrl);
    // If config points to /dashboard, replace with /open-product
    const pathname = url.pathname.replace(/\/$/, '');
    if (pathname.endsWith('/dashboard')) {
      url.pathname = pathname.slice(0, -'/dashboard'.length) + '/open-product';
    } else {
      url.pathname = '/open-product';
    }

    if (payload?.productRef) {
      url.searchParams.set('productRef', String(payload.productRef));
    }
    if (payload?.query) {
      url.searchParams.set('query', String(payload.query));
    }

    return url.toString();
  } catch (err) {
    // Fallback
    const fallback = 'http://localhost:4200/open-product';
    const qs = new URLSearchParams();
    if (payload?.productRef) qs.set('productRef', String(payload.productRef));
    if (payload?.query) qs.set('query', String(payload.query));
    const suffix = qs.toString();
    return suffix ? `${fallback}?${suffix}` : fallback;
  }
}

async function handleToggleExtension(active) {
  extensionActive = active;
  await chrome.storage.local.set({ extensionActive: active });

  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'EXTENSION_STATE_CHANGED',
      active: active
    }).catch(() => {
      // Ignorar errores si el content script no está cargado
    });
  }
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes.extensionActive) {
    return;
  }

  extensionActive = Boolean(changes.extensionActive.newValue);
});