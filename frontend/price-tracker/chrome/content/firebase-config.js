(function initFirebaseConfig(global) {
  const PriceTracker = (global.PriceTracker = global.PriceTracker || {});

  // Valor por defecto - será sobrescrito por chrome.storage
  let firebaseConfig = null;

  /**
   * Carga la configuración de Firebase desde chrome.storage
   * @returns {Promise<Object>} Configuración de Firebase
   */
  async function loadFirebaseConfig() {
    try {
      const result = await chrome.storage.sync.get('firebaseConfig');
      
      if (result.firebaseConfig) {
        firebaseConfig = result.firebaseConfig;
        console.log('[FIREBASE CONFIG] ✓ Configuración cargada desde chrome.storage');
        return firebaseConfig;
      } else {
        console.warn('[FIREBASE CONFIG] ⚠ No hay configuración en chrome.storage');
        // Retorna null - el usuario debe configurar vía popup
        return null;
      }
    } catch (error) {
      console.error('[FIREBASE CONFIG] Error cargando configuración:', error);
      return null;
    }
  }

  /**
   * Obtiene la configuración actual (puede ser null si no está configurada)
   */
  function getConfig() {
    return firebaseConfig;
  }

  /**
   * Guarda la configuración en chrome.storage
   * @param {Object} config - Configuración de Firebase
   */
  async function saveConfig(config) {
    try {
      await chrome.storage.sync.set({ firebaseConfig: config });
      firebaseConfig = config;
      console.log('[FIREBASE CONFIG] ✓ Configuración guardada en chrome.storage');
      return true;
    } catch (error) {
      console.error('[FIREBASE CONFIG] Error guardando configuración:', error);
      return false;
    }
  }

  PriceTracker.firebaseConfig = firebaseConfig;
  PriceTracker.firebaseConfigManager = {
    loadFirebaseConfig,
    getConfig,
    saveConfig,
  };

  console.log('[FIREBASE CONFIG] Inicializado (sin credenciales hardcodeadas)');
})(window);
