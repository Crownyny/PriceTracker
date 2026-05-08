# Integración de Firebase en Price Tracker Extension

## Resumen
La extensión de Chrome ahora usa Firebase para autenticar usuarios. Los tokens se obtienen de forma segura en el popup y se guardan en `chrome.storage` para que la extensión los use cuando llame a la API de intención.

## Arquitectura

### Flujo de Autenticación

```
┌─────────────────────────────────────────────────────────────┐
│                   USUARIO EN GOOGLE SEARCH                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │   Extensión se carga         │
        │   (content.js)               │
        └──────────────────┬───────────┘
                           │
                           ▼
        ┌──────────────────────────────┐
        │   Popup abierto (click)      │
        └──────────────────┬───────────┘
                           │
                           ▼
        ┌──────────────────────────────┐
        │   Firebase se inicia         │
        │   (popup.html)               │
        └──────────────────┬───────────┘
                           │
                           ▼
        ┌──────────────────────────────┐
        │   Usuario hace login/logout  │
        └──────────────────┬───────────┘
                           │
                           ▼
        ┌──────────────────────────────┐
        │   Token guardado en          │
        │   chrome.storage             │
        └──────────────────┬───────────┘
                           │
                           ▼
        ┌──────────────────────────────┐
        │   Extensión lee token de     │
        │   chrome.storage             │
        └──────────────────┬───────────┘
                           │
                           ▼
        ┌──────────────────────────────┐
        │   Llamada a /api/intent      │
        │   CON token en Authorization │
        └──────────────────┬───────────┘
                           │
                           ▼
        ┌──────────────────────────────┐
        │   Backend valida con         │
        │   @PreAuthorize              │
        └──────────────────────────────┘
```

## Archivos Modificados

### 1. `popup.html` ✅
- Carga Firebase SDK desde CDN
- Botones de "Iniciar sesión" y "Cerrar sesión"
- Muestra email del usuario autenticado

### 2. `content/firebase-auth.service.js` ✅
- **Simplificado**: Lee token de `chrome.storage`
- No carga Firebase SDK (por limitaciones de Manifest V3)
- Funciones: `getAuthToken()`, `isAuthenticated()`, etc.

### 3. `content/firebase-config.js` ✅
- Configuración de Firebase (ya no se usa en extensión)
- Se mantiene para referencia

### 4. `background/firebase-popup-auth.js` ✅
- Servicio de autenticación para popup
- Que realiza login con Google
- Maneja guardar token en chrome.storage

### 5. `manifest.json` ✅
- Agregado `content_security_policy` para permitir Firebase CDN
- Scripts en orden correcto

### 6. `search-workflow.service.js` ✅
- Obtiene token de `firebaseAuthService`
- Lo incluye en header `Authorization: Bearer <token>`

## Cómo Funciona

### Paso 1: Usuario abre el popup (click en icono)
- Firebase se inicializa en `popup.html`
- Se cargan `firebase-app.js` y `firebase-auth.js` desde CDN

### Paso 2: Usuario hace login
- Botón "Iniciar sesión con Google" → Google login popup
- Firebase obtiene el token JWT
- Token se guarda en `chrome.storage.local`

### Paso 3: Extensión usa el token
- Cuando usuario hace búsqueda en Google
- `firebaseAuthService.getAuthToken()` lee de `chrome.storage`
- Token se envía en header `Authorization: Bearer <token>`
- Backend valida y responde ✓

## Logs en Consola

**En el Popup (DevTools del popup):**
```
[FIREBASE] Popup cargado
[FIREBASE] Firebase inicializado en popup
[FIREBASE] Popup: Usuario autenticado y token guardado: usuario@gmail.com
```

**En la página de Google (DevTools de Google Search):**
```
[PRICE TRACKER] [FIREBASE] Auth service cargado (usando chrome.storage)
[PRICE TRACKER] [FIREBASE] Token obtenido del storage
[PRICE TRACKER] [INTENT] Token de Firebase obtenido
[PRICE TRACKER] [INTENT] ✓ BUY
```

## Requisitos

1. ✅ Firebase SDK cargado en popup.html
2. ✅ CSP permite `https://www.gstatic.com`
3. ✅ Usuario autenticado en popup
4. ✅ Token guardado en chrome.storage
5. ✅ Backend valida tokens con FirebaseAuthService

## Testing Manual

### Paso 1: Verificar que Popup se carga
1. Click en icono de extensión
2. Debe aparecer sección de autenticación en popup
3. DevTools (F12 en popup): buscar `[FIREBASE]` logs

### Paso 2: Hacer login
1. Click en "Iniciar sesión con Google"
2. Google popup de login
3. Completar autenticación
4. Debe aparecer email en popup
5. Botón cambio a "Cerrar sesión"

### Paso 3: Verificar que token se usa
1. DevTools en Google Search (F12)
2. Realiza búsqueda
3. Busca logs `[INTENT]` en console
4. Debe incluir token en request

### Paso 4: Verificar backend
1. Revisa logs del backend
2. `@PreAuthorize` debe validar token exitosamente
3. Response 200 OK (no 401)

## Solución de Problemas

### ❌ "No hay usuario autenticado"
- **Causa**: No has hecho login en el popup
- **Solución**: Abre popup y haz click en "Iniciar sesión con Google"

### ❌ "Token obtenido del storage" pero luego "401 Unauthorized"
- **Causa**: Token expirado o inválido
- **Solución**: Cierra sesión y vuelve a iniciar sesión en popup

### ❌ "POST http://localhost:8080/api/intent/intent" 401
- **Causa**: Token no se envía o backend no lo valida
- **Solución**: 
  - Verifica `Authorization` header en DevTools Network
  - Revisa backend logs para errores de Firebase

### ❌ "Chrome blocked request to gstatic.com"
- **Causa**: CSP no está configurado en manifest
- **Solución**: Verifica que manifest tenga `content_security_policy`

### ❌ "Popup no carga Firebase"
- **Causa**: CDN https://www.gstatic.com bloqueada
- **Solución**: Verifica internet, recarga popup

## Configuración para Desarrollo

Si necesitas cambiar credenciales de Firebase:

1. **En popup.html**: 
   - Reemplaza `firebaseConfigLocal` en `firebase-popup-auth.js`

2. **En extensión**: 
   - Reemplaza config en `content/firebase-config.js`

3. **Recarga extensión**:
   - Ve a `chrome://extensions/`
   - Click en reload/actualizar

## Notas de Seguridad

✅ **Bien hecho:**
- Token se obtiene en contexto seguro (popup)
- Se almacena en `chrome.storage` (local a la extensión)
- Se envía solo a `localhost:8080` (tu backend)

⚠️ **Ten cuidado:**
- No compartir credenciales Firebase
- No poner secrets en archivos JS públicos
- CSP debe estar restrictivo

## Próximos Pasos (Opcional)

1. **Token refresh automático**: 
   - Implementar refresh cuando expire
   
2. **Logout automático**:
   - Limpiar token si usuario cierra sesión en Google

3. **Polling del estado**:
   - Verificar periodicamente si token sigue siendo válido

