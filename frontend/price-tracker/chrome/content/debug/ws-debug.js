(function initWSDebug(global) {
  const PriceTracker = (global.PriceTracker = global.PriceTracker || {});
  const { constants } = PriceTracker;
  
  window.testWSConnection = async function() {
    console.log('[WS DEBUG] Iniciando prueba de conexión WebSocket...');
    
    const wsUrl = (constants.WS.BASE_URL || 'ws://localhost:8080') + (constants.WS.ENDPOINT || '/ws');
    console.log(`[WS DEBUG] URL: ${wsUrl}`);
    
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          console.log('[WS DEBUG] ✅ WebSocket ABIERTO - Conexión exitosa');
          ws.close();
          resolve('OK');
        };
        
        ws.onerror = (error) => {
          console.error('[WS DEBUG] ❌ WebSocket ERROR:', error);
          reject('ERROR');
        };
        
        ws.onclose = () => {
          console.log('[WS DEBUG] WebSocket CERRADO (esperado después de prueba)');
        };
        
        // Timeout de 5 segundos
        setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN && ws.readyState !== WebSocket.CLOSED) {
            console.error('[WS DEBUG] ❌ TIMEOUT - No se conectó en 5 segundos');
            ws.close();
            reject('TIMEOUT');
          }
        }, 5000);
        
      } catch (error) {
        console.error('[WS DEBUG] ❌ Excepción:', error);
        reject(error);
      }
    });
  };
  
  window.testHTTPSConnection = async function() {
    console.log('[WS DEBUG] Probando conexión HTTPS...');
    
    const baseUrl = constants.API.BASE_URL || 'https://localhost:8443';
    const healthUrl = baseUrl + '/actuator/health';
    console.log(`[WS DEBUG] Health URL: ${healthUrl}`);
    
    try {
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log(`[WS DEBUG] ✅ HTTPS OK - Status: ${response.status}`);
      return 'OK';
    } catch (error) {
      console.error(`[WS DEBUG] ❌ HTTPS ERROR:`, error.message);
      return 'ERROR';
    }
  };
  
  window.runWSTests = async function() {
    console.log('\n========== INICIANDO TESTS ==========\n');
    
    console.log('DIAGNOSTICOS INICIALES:');
    console.log('WS.BASE_URL:', constants.WS.BASE_URL);
    console.log('WS.ENDPOINT:', constants.WS.ENDPOINT);
    console.log('WS URL completa:', (constants.WS.BASE_URL || 'ws://localhost:8080') + (constants.WS.ENDPOINT || '/ws'));
    console.log('API.BASE_URL:', constants.API.BASE_URL);
    console.log('');
    
    console.log('1. Probando HTTPS...');
    const httpsResult = await window.testHTTPSConnection();
    
    console.log('\n2. Probando WebSocket...');
    try {
      const wsResult = await window.testWSConnection();
      console.log(`   Resultado: ${wsResult}`);
    } catch (error) {
      console.log(`   Resultado: ${error}`);
    }
    
    console.log('\n========== FIN TESTS ==========\n');
  };
  
  console.log('[WS DEBUG] Debug tools cargados. Usa: window.runWSTests()');
})(window);
