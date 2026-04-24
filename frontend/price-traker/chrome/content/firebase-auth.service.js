(function initFirebaseAuthService(global) {
  const PriceTracker = (global.PriceTracker = global.PriceTracker || {});
  const { constants } = PriceTracker;

  const STORAGE_KEY = 'firebaseAuthToken';
  const USER_EMAIL_KEY = 'firebaseUserEmail';

  /**
   * Obtiene el token de autenticación del almacenamiento local
   * @returns {Promise<string|null>} Token JWT o null
   */
  async function getAuthToken() {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEY]);
      const token = result[STORAGE_KEY];
      
      if (token) {
        console.log(`${constants.LOG_PREFIX} [FIREBASE] Token obtenido del storage`);
        return token;
      } else {
        console.warn(`${constants.LOG_PREFIX} [FIREBASE] No hay token en storage - usuario no autenticado o token expirado`);
        return null;
      }
    } catch (error) {
      console.error(`${constants.LOG_PREFIX} [FIREBASE] Error obteniendo token:`, error);
      return null;
    }
  }

  /**
   * Obtiene el token actual sin refrescarlo
   * @returns {Promise<string|null>}
   */
  async function getCurrentToken() {
    return getAuthToken();
  }

  /**
   * Obtiene el email del usuario desde storage
   * @returns {Promise<string|null>}
   */
  async function getUserEmail() {
    try {
      const result = await chrome.storage.local.get([USER_EMAIL_KEY]);
      return result[USER_EMAIL_KEY] || null;
    } catch (error) {
      console.error(`${constants.LOG_PREFIX} [FIREBASE] Error obteniendo email:`, error);
      return null;
    }
  }

  /**
   * Verifica si existe un token válido
   * @returns {Promise<boolean>}
   */
  async function isAuthenticated() {
    const token = await getAuthToken();
    return token !== null;
  }

  /**
   * Escucha cambios en el token (almacenamiento)
   * @param {Function} callback Función que se ejecuta cuando cambia el token
   * @returns {Function} Función para desuscribirse
   */
  function onAuthStateChanged(callback) {
    try {
      const handleStorageChange = (changes, areaName) => {
        if (areaName !== 'local') return;
        
        if (changes[STORAGE_KEY]) {
          const token = changes[STORAGE_KEY].newValue;
          if (token) {
            console.log(`${constants.LOG_PREFIX} [FIREBASE] Usuario autenticado (token en storage)`);
            callback(true);
          } else {
            console.log(`${constants.LOG_PREFIX} [FIREBASE] Usuario cerró sesión (token removido)`);
            callback(false);
          }
        }
      };

      chrome.storage.onChanged.addListener(handleStorageChange);
      
      // Retornar función para desuscribirse
      return () => {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      };
    } catch (error) {
      console.error(`${constants.LOG_PREFIX} [FIREBASE] Error escuchando cambios:`, error);
      return () => {};
    }
  }

  /**
   * Limpia el token del storage (logout)
   * @returns {Promise<void>}
   */
  async function logout() {
    try {
      await chrome.storage.local.remove([STORAGE_KEY, USER_EMAIL_KEY]);
      console.log(`${constants.LOG_PREFIX} [FIREBASE] Token removido del storage`);
    } catch (error) {
      console.error(`${constants.LOG_PREFIX} [FIREBASE] Error removiendo token:`, error);
    }
  }

  // Exportar el servicio
  PriceTracker.firebaseAuthService = {
    getAuthToken,
    getCurrentToken,
    getUserEmail,
    isAuthenticated,
    onAuthStateChanged,
    logout,
    STORAGE_KEY,
    USER_EMAIL_KEY,
  };

  console.log(`${constants.LOG_PREFIX} [FIREBASE] Auth service cargado (usando chrome.storage)`);
})(window);
