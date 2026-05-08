/* Firebase Auth para el Popup
   Se carga en popup.html para que usuarios puedan autenticarse
*/

let firebaseConfigLocal = null;
let firebaseInitialized = false;

/**
 * Carga la configuración de Firebase desde chrome.storage
 */
async function loadFirebaseConfigFromStorage() {
  try {
    const result = await chrome.storage.sync.get('firebaseConfig');
    
    if (result.firebaseConfig) {
      firebaseConfigLocal = result.firebaseConfig;
      console.log('[FIREBASE POPUP] ✓ Configuración cargada desde storage:', result.firebaseConfig.projectId);
      return true;
    } else {
      console.error('[FIREBASE POPUP] ✗ No hay configuración de Firebase en chrome.storage');
      console.warn('[FIREBASE POPUP] Asegúrate de haber configurado Firebase en .env.local o manualmente');
      return false;
    }
  } catch (error) {
    console.error('[FIREBASE POPUP] Error cargando configuración:', error);
    return false;
  }
}

/**
 * Inicializa Firebase en el popup
 */
async function initializeFirebaseForPopup() {
  if (firebaseInitialized) {
    return true;
  }

  try {
    // Cargar configuración primero
    const configLoaded = await loadFirebaseConfigFromStorage();
    
    if (!configLoaded) {
      console.error('[FIREBASE POPUP] No se pudo cargar configuración, popup no disponible');
      return false;
    }

    if (!window.firebase) {
      console.error('[FIREBASE POPUP] Firebase SDK no cargado en el popup');
      return false;
    }

    // Inicializar Firebase con configuración cargada
    const app = firebase.initializeApp(firebaseConfigLocal);
    firebaseInitialized = true;
    console.log('[FIREBASE POPUP] ✓ Firebase inicializado');
    
    // Escuchar cambios en autenticación
    const auth = firebase.auth();
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        const token = await user.getIdToken();
        const email = user.email;
        
        // Guardar en chrome.storage para que la extensión lo use
        await chrome.storage.local.set({
          'firebaseAuthToken': token,
          'firebaseUserEmail': email
        });
        
        console.log(`[FIREBASE POPUP] ✓ Usuario autenticado: ${email}`);
        updatePopupUI('authenticated', email);
      } else {
        // Limpiar token
        await chrome.storage.local.remove(['firebaseAuthToken', 'firebaseUserEmail']);
        console.log('[FIREBASE POPUP] Usuario cerró sesión');
        updatePopupUI('unauthenticated');
      }
    });

    return true;
  } catch (error) {
    console.error('[FIREBASE POPUP] Error inicializando Firebase:', error);
    return false;
  }
}

/**
 * Actualiza la UI del popup según estado de autenticación
 */
function updatePopupUI(state, email = null) {
  const loginForm = document.getElementById('loginForm');
  const authContainer = document.getElementById('authContainer');
  const userEmail = document.getElementById('userEmail');
  const logoutBtn = document.getElementById('logoutBtn');

  if (state === 'authenticated' && email) {
    if (loginForm) loginForm.style.display = 'none';
    if (authContainer) authContainer.style.display = 'block';
    if (logoutBtn) logoutBtn.style.display = 'block';
    if (userEmail) userEmail.textContent = `Autenticado como: ${email}`;
  } else {
    if (loginForm) loginForm.style.display = 'block';
    if (authContainer) authContainer.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (userEmail) userEmail.textContent = '';
  }
}

/**
 * Maneja login con email y contraseña
 */
async function handleEmailLogin(email, password) {
  try {
    if (!firebaseInitialized) {
      const initialized = await initializeFirebaseForPopup();
      if (!initialized) {
        alert('Error inicializando Firebase');
        return;
      }
    }

    const auth = firebase.auth();
    
    // Mostrar loading
    const loginBtn = document.getElementById('loginBtn');
    const originalText = loginBtn?.textContent;
    if (loginBtn) loginBtn.textContent = 'Iniciando sesión...';
    if (loginBtn) loginBtn.disabled = true;

    try {
      const result = await auth.signInWithEmailAndPassword(email, password);
      const token = await result.user.getIdToken();
      
      // Guardar token en chrome.storage
      await chrome.storage.local.set({
        'firebaseAuthToken': token,
        'firebaseUserEmail': result.user.email
      });
      
      console.log(`[FIREBASE] Login exitoso: ${result.user.email}`);
      updatePopupUI('authenticated', result.user.email);
      
      // Limpiar campos
      const emailInput = document.getElementById('emailInput');
      const passwordInput = document.getElementById('passwordInput');
      if (emailInput) emailInput.value = '';
      if (passwordInput) passwordInput.value = '';
      
    } catch (error) {
      console.error('[FIREBASE] Error en login:', error);
      
      // Mostrar error amigable
      let errorMsg = 'Error de login';
      if (error.code === 'auth/user-not-found') {
        errorMsg = 'Usuario no encontrado';
      } else if (error.code === 'auth/wrong-password') {
        errorMsg = 'Contraseña incorrecta';
      } else if (error.code === 'auth/invalid-email') {
        errorMsg = 'Email inválido';
      } else if (error.code === 'auth/too-many-requests') {
        errorMsg = 'Demasiados intentos. Intenta más tarde.';
      }
      
      alert(`❌ ${errorMsg}: ${error.message}`);
      
      if (loginBtn) loginBtn.textContent = originalText;
      if (loginBtn) loginBtn.disabled = false;
    }
  } catch (error) {
    console.error('[FIREBASE] Error inesperado en login:', error);
    alert(`Error: ${error.message}`);
  }
}

/**
 * Maneja logout
 */
async function handleLogout() {
  try {
    if (!firebaseInitialized) {
      return;
    }

    const auth = firebase.auth();
    await auth.signOut();
    
    // Limpiar chrome.storage
    await chrome.storage.local.remove(['firebaseAuthToken', 'firebaseUserEmail']);
    
    console.log('[FIREBASE] Logout exitoso');
    updatePopupUI('unauthenticated');
  } catch (error) {
    console.error('[FIREBASE] Error en logout:', error);
    alert(`Error en logout: ${error.message}`);
  }
}

/**
 * Verifica el estado actual de autenticación
 */
async function checkAuthState() {
  try {
    const result = await chrome.storage.local.get(['firebaseAuthToken', 'firebaseUserEmail']);
    const token = result.firebaseAuthToken;
    const email = result.firebaseUserEmail;
    
    if (token && email) {
      updatePopupUI('authenticated', email);
    } else {
      updatePopupUI('unauthenticated');
    }
  } catch (error) {
    console.error('[FIREBASE] Error verificando autenticación:', error);
  }
}

// Inicializar cuando el popup se carga
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[FIREBASE] Popup cargado');
  
  // Inicializar Firebase si está disponible
  if (window.firebase) {
    await initializeFirebaseForPopup();
  }
  
  // Verificar estado inicial
  await checkAuthState();
  
  // Listeners para formulario de login
  const loginForm = document.getElementById('loginForm');
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const emailInput = document.getElementById('emailInput');
  const passwordInput = document.getElementById('passwordInput');
  
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = emailInput?.value;
      const password = passwordInput?.value;
      
      if (!email || !password) {
        alert('Por favor completa email y contraseña');
        return;
      }
      
      handleEmailLogin(email, password);
    });
  }
  
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
});
