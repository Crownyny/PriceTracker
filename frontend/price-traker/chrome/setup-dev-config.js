/**
 * Script para cargar configuración desde .env en desarrollo
 * 
 * Uso:
 * 1. En background.js, importa este script:
 *    importScripts(..., 'setup-dev-config.js', ...);
 * 
 * 2. Llamarlo antes de que se necesite la configuración:
 *    await setupDevConfig();
 */

async function setupDevConfig() {
  try {
    console.log('[SETUP DEV CONFIG] Intentando cargar configuración de desarrollo...');

    // Intentar cargar .env - Usar chrome.runtime.getURL() para obtener la URL correcta
    const envFilePath = chrome.runtime.getURL('.env');
    
    try {
      const response = await fetch(envFilePath);
      
      if (!response.ok) {
        console.warn('[SETUP DEV CONFIG] Archivo .env no encontrado (status ' + response.status + '), usando configuración existente');
        return;
      }

      const envContent = await response.text();
      const envConfig = parseEnvFile(envContent);

      // Validar que tenemos credenciales
      if (!envConfig.FIREBASE_API_KEY || envConfig.FIREBASE_API_KEY.includes('your_')) {
        console.warn('[SETUP DEV CONFIG] .env contiene placeholders, necesitas configurar Firebase');
        return;
      }

      // Construir configuración de Firebase
      const firebaseConfig = {
        apiKey: envConfig.FIREBASE_API_KEY,
        authDomain: envConfig.FIREBASE_AUTH_DOMAIN,
        projectId: envConfig.FIREBASE_PROJECT_ID,
        storageBucket: envConfig.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: envConfig.FIREBASE_MESSAGING_SENDER_ID,
        appId: envConfig.FIREBASE_APP_ID,
        measurementId: envConfig.FIREBASE_MEASUREMENT_ID || '',
      };

      // Guardar en chrome.storage
      await chrome.storage.sync.set({ firebaseConfig });
      
      console.log('[SETUP DEV CONFIG] ✓ Configuración cargada desde .env');
      console.log('[SETUP DEV CONFIG] Proyecto:', firebaseConfig.projectId);
      
    } catch (fileError) {
      console.warn('[SETUP DEV CONFIG] No se pudo cargar .env:', fileError.message);
    }

  } catch (error) {
    console.error('[SETUP DEV CONFIG] Error:', error);
  }
}

/**
 * Parsea un archivo .env simple
 * @param {string} content - Contenido del archivo .env
 * @returns {Object} Objeto con las variables de entorno
 */
function parseEnvFile(content) {
  const config = {};
  
  const lines = content.split('\n');
  for (const line of lines) {
    // Ignorar comentarios y líneas vacías
    if (line.startsWith('#') || line.trim() === '') {
      continue;
    }

    // Parsear KEY=VALUE
    const [key, ...valueParts] = line.split('=');
    const trimmedKey = key.trim();
    const value = valueParts.join('=').trim();

    if (trimmedKey && value) {
      config[trimmedKey] = value;
    }
  }

  return config;
}

// Exportar para uso en background script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { setupDevConfig, parseEnvFile };
}
