/**
 * Script para cargar Firebase Configuration y UI en el popup
 */

/**
 * Inicia la configuración de Firebase cuando el popup se abre
 */
async function initPopupFirebaseSetup() {
  try {
    console.log('[POPUP] Verificando configuración de Firebase...');

    // Cargar configuración desde storage
    const result = await chrome.storage.sync.get('firebaseConfig');
    
    if (!result.firebaseConfig) {
      console.warn('[POPUP] No hay configuración de Firebase, mostrando formulario de setup');
      showSetupForm();
    } else {
      console.log('[POPUP] ✓ Configuración encontrada, inicializando Firebase');
      // Inicializar Firebase en el popup
      await initializeFirebaseForPopup();
    }
  } catch (error) {
    console.error('[POPUP] Error en setup:', error);
    showSetupForm();
  }
}

/**
 * Muestra el formulario para configurar Firebase
 */
function showSetupForm() {
  const container = document.getElementById('popupContainer');
  
  if (!container) {
    console.error('[POPUP] No encontré el contenedor del popup');
    return;
  }

  container.innerHTML = `
    <div id="setupForm" class="setup-form">
      <h2>Configurar Firebase</h2>
      <p>Ingresa tus credenciales de Firebase</p>
      
      <div class="form-group">
        <label for="apiKey">API Key:</label>
        <input type="text" id="apiKey" placeholder="AIzaSy..." />
      </div>
      
      <div class="form-group">
        <label for="authDomain">Auth Domain:</label>
        <input type="text" id="authDomain" placeholder="project.firebaseapp.com" />
      </div>
      
      <div class="form-group">
        <label for="projectId">Project ID:</label>
        <input type="text" id="projectId" placeholder="my-project" />
      </div>
      
      <div class="form-group">
        <label for="storageBucket">Storage Bucket:</label>
        <input type="text" id="storageBucket" placeholder="project.firebasestorage.app" />
      </div>
      
      <div class="form-group">
        <label for="messagingSenderId">Messaging Sender ID:</label>
        <input type="text" id="messagingSenderId" placeholder="123456..." />
      </div>
      
      <div class="form-group">
        <label for="appId">App ID:</label>
        <input type="text" id="appId" placeholder="1:123456:web:..." />
      </div>
      
      <div class="form-group">
        <label for="measurementId">Measurement ID (opcional):</label>
        <input type="text" id="measurementId" placeholder="G-XXXXXXXXXX" />
      </div>
      
      <button id="saveFirebaseConfigBtn" class="btn btn-primary">Guardar Configuración</button>
      <p class="help-text">
        Obtén estas credenciales de 
        <a href="https://console.firebase.google.com" target="_blank">Firebase Console</a> 
        → Configuración del Proyecto → Tu App
      </p>
    </div>
  `;

  // Event listener para guardar
  document.getElementById('saveFirebaseConfigBtn').addEventListener('click', saveFirebaseConfig);
}

/**
 * Guarda la configuración de Firebase ingresada por el usuario
 */
async function saveFirebaseConfig() {
  try {
    const config = {
      apiKey: document.getElementById('apiKey').value,
      authDomain: document.getElementById('authDomain').value,
      projectId: document.getElementById('projectId').value,
      storageBucket: document.getElementById('storageBucket').value,
      messagingSenderId: document.getElementById('messagingSenderId').value,
      appId: document.getElementById('appId').value,
      measurementId: document.getElementById('measurementId').value || '',
    };

    // Validar que todos los campos requeridos estén completos
    if (!config.apiKey || !config.authDomain || !config.projectId) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    // Guardar en chrome.storage
    await chrome.storage.sync.set({ firebaseConfig: config });
    
    console.log('[POPUP] ✓ Configuración guardada');
    alert('✓ Configuración de Firebase guardada. Por favor, recarga la extensión.');
  } catch (error) {
    console.error('[POPUP] Error guardando configuración:', error);
    alert('Error guardando configuración: ' + error.message);
  }
}

// Esperar a que el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPopupFirebaseSetup);
} else {
  initPopupFirebaseSetup();
}
