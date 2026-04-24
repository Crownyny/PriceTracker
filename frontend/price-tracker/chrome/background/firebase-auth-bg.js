// Background Service Worker para AUTENTICACIÓN con Firebase
// Este archivo maneja Firebase Authentication de forma segura

importScripts('vendor/sockjs.min.js', 'vendor/stomp.umd.min.js', 'background/ws-relay.js');

// Agregar Firebase SDK
(function loadFirebase() {
  // Importar dinámicamente Firebase
  const firebaseConfig = {
    apiKey: "AIzaSyCpXGbxnNVXcHOtL01ImblW3e8aRdDPhq4",
    authDomain: "price-tracker-60c8c.firebaseapp.com",
    projectId: "price-tracker-60c8c",
    storageBucket: "price-tracker-60c8c.firebasestorage.app",
    messagingSenderId: "933689005506",
    appId: "1:933689005506:web:42b5f571a272bc0b7db25b",
    measurementId: "G-K6601BQ4Q4"
  };

  // Cargar Firebase globalmente
  const firebaseScript = document.createElement('script');
  firebaseScript.src = 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
  
  firebaseScript.onload = () => {
    const authScript = document.createElement('script');
    authScript.src = 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
    authScript.onload = () => {
      // Inicializar Firebase
      if (window.firebase) {
        firebase.initializeApp(firebaseConfig);
        console.log('[PRICE TRACKER] Firebase inicializado en Background');
        
        // Escuchar cambios en autenticación
        const auth = firebase.auth();
        auth.onAuthStateChanged(async (user) => {
          if (user) {
            const token = await user.getIdToken();
            const email = user.email;
            
            // Guardar en chrome.storage
            await chrome.storage.local.set({
              'firebaseAuthToken': token,
              'firebaseUserEmail': email
            });
            
            console.log(`[FIREBASE] Usuario autenticado: ${email}`);
            
            // Notificar a todos los tabs
            const tabs = await chrome.tabs.query({});
            for (const tab of tabs) {
              chrome.tabs.sendMessage(tab.id, {
                type: 'FIREBASE_AUTH_CHANGED',
                authenticated: true,
                email: email
              }).catch(() => {});
            }
          } else {
            // Limpiar token
            await chrome.storage.local.remove(['firebaseAuthToken', 'firebaseUserEmail']);
            console.log('[FIREBASE] Usuario cerró sesión');
            
            // Notificar a todos los tabs
            const tabs = await chrome.tabs.query({});
            for (const tab of tabs) {
              chrome.tabs.sendMessage(tab.id, {
                type: 'FIREBASE_AUTH_CHANGED',
                authenticated: false
              }).catch(() => {});
            }
          }
        });
      }
    };
    
    document.head.appendChild(authScript);
  };
  
  document.head.appendChild(firebaseScript);
})();
