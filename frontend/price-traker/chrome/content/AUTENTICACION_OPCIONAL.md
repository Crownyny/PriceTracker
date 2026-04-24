# Autenticación Opcional en Price Tracker

## Resumen de Cambios

La autenticación con Firebase **NO es obligatoria** para usar la extensión. Funciona de forma **opcional**:

- ✅ **SIN login**: Búsqueda de precios gratis (servicio público)
- ✅ **CON login**: Acceso a historial, alertas y servicios freemium

---

## Arquitectura de Servicios

### 1. Servicios Públicos (SIN autenticación)

```
┌─────────────────────────────────────────────────┐
│           SERVICIOS PÚBLICOS (Gratis)          │
├─────────────────────────────────────────────────┤
│ GET  /api/search                                │
│ POST /api/intent/intent                         │
└─────────────────────────────────────────────────┘
```

**Características:**
- No requieren token Firebase
- Disponible para todos los usuarios
- NO requiere `@PreAuthorize("isAuthenticated()")`

**Llamadas desde extensión:**
```javascript
// SIN token - funciona igual
fetch('http://localhost:8080/api/intent/intent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'laptop' })
  // NO Authorization header
});
```

---

### 2. Servicios Restringidos (CON autenticación)

```
┌─────────────────────────────────────────────────┐
│       SERVICIOS RESTRINGIDOS (Freemium)        │
├─────────────────────────────────────────────────┤
│ GET    /api/v1/products/{id}/priceHistory      │
│ GET    /api/v1/products/{id}/alert             │
│ POST   /api/v1/products/{id}/alert             │
│ DELETE /api/v1/products/{id}/alert             │
│ PATCH  /api/v1/products/{id}/alert             │
│ PUT    /api/v1/products/{id}/alert             │
└─────────────────────────────────────────────────┘
```

**Características:**
- **REQUIEREN** token Firebase válido
- Usan `@PreAuthorize("isAuthenticated()")`
- Backend extrae `uid` del JWT y sincroniza usuario
- Retornan 401 si no hay token válido

**Llamadas desde extensión:**
```javascript
// CON token - solo si usuario está autenticado
const token = await firebaseAuthService.getAuthToken();

fetch('http://localhost:8080/api/v1/products/ABC123/priceHistory', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`  // ← Token obligatorio
  }
});
```

---

## Flujos de Uso

### Flujo 1: Usuario SIN Login (Búsqueda Gratis)

```
1. Usuario abre Google Search
   ↓
2. Extensión se carga
   ↓
3. Usuario busca "laptop"
   ↓
4. Extensión llama /api/intent/intent (SIN token)
   ↓
5. Backend devuelve intención: BUY / NOT_BUY
   ↓
6. Extensión llama /api/search (SIN token)
   ↓
7. Backend devuelve resultados de búsqueda
   ✅ FUNCIONA - NO requiere autenticación
```

**Logs esperados:**
```
[PRICE TRACKER] [INTENT] Usuario no autenticado - búsqueda gratis sin perfil
[PRICE TRACKER] [INTENT] ✓ BUY
[PRICE TRACKER] [SEARCH] Starting search...
```

---

### Flujo 2: Usuario CON Login (Freemium)

```
1. Usuario abre extensión (popup)
   ↓
2. Usuario hace click en "Iniciar sesión"
   ↓
3. Ingresa email + contraseña de Firebase
   ↓
4. Firebase valida credenciales → genera JWT
   ↓
5. Token guardado en chrome.storage
   ↓
6. Usuario busca "laptop"
   ↓
7. Extensión obtiene token del storage
   ↓
8. Extensión llama /api/intent/intent (CON token)
   ↓
9. Backend valida JWT → extrae uid → sincroniza usuario
   ↓
10. Backend devuelve intención + contexto del usuario
    ↓
11. Extensión llama /api/search (CON token)
    ↓
12. Backend devuelve resultados + historial del usuario
    ↓
13. Extensión puede acceder a /api/v1/products/{id}/alert (CON token)
    ✅ FUNCIONA - CON autenticación
```

**Logs esperados:**
```
[PRICE TRACKER] [INTENT] Token de Firebase obtenido (usuario autenticado)
[PRICE TRACKER] [INTENT] ✓ BUY
[Backend logs] Validating JWT for user uid=xyz
[Backend logs] Lazy user sync: created new user from Firebase
[PRICE TRACKER] [SEARCH] Starting search with user context...
```

---

## Cambios en Backend Necesarios

### ✅ Endpoints Públicos (NO protegidos)

```java
@PostMapping("intent")
// NO @PreAuthorize - permite acceso público
public IntentResponseDTOIN getIntentPredict(@RequestBody ModelQueryDTO param) {
    return intentProductService.getIntentResponse(param).block();
}

@GetMapping("search")
// NO @PreAuthorize - permite acceso público
public SearchResultsDTO search(@RequestParam String query) {
    return searchService.search(query);
}
```

### 🔐 Endpoints Protegidos (CON autenticación)

```java
@GetMapping("/{productId}/priceHistory")
@PreAuthorize("isAuthenticated()")  // ← REQUIERE autenticación
public PriceHistoryDTO getPriceHistory(@PathVariable String productId) {
    // Extraer usuario autenticado
    String uid = SecurityContextHolder.getContext()
        .getAuthentication()
        .getPrincipal();
    
    // Sincronizar usuario si es primera vez
    userService.syncUserIfNeeded(uid);
    
    // Retornar historial del usuario
    return priceHistoryService.getHistoryForProduct(productId, uid);
}

@PostMapping("/{productId}/alert")
@PreAuthorize("isAuthenticated()")  // ← REQUIERE autenticación
public AlertDTO createAlert(
    @PathVariable String productId,
    @RequestBody CreateAlertRequest request
) {
    String uid = SecurityContextHolder.getContext()
        .getAuthentication()
        .getPrincipal();
    
    return alertService.createAlert(uid, productId, request);
}
```

---

## Comportamiento de la Extensión

### Token Obtención

```javascript
// Verificar si usuario está autenticado
const isAuthenticated = await firebaseAuthService.isAuthenticated();

if (isAuthenticated) {
    // Usuario hizo login - obtener token
    const token = await firebaseAuthService.getAuthToken();
    console.log('[INTENT] Token de Firebase obtenido (usuario autenticado)');
} else {
    // Usuario no hace login - búsqueda anónima
    console.log('[INTENT] Usuario no autenticado - búsqueda gratis sin perfil');
}
```

### Headers Dinámicos

```javascript
const headers = {
    'Content-Type': 'application/json',
};

// Agregar token SOLO si existe
if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
}

fetch(apiUrl, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ query })
});
```

---

## Manejo de Errores

### Caso 1: Búsqueda SIN autenticación (Normal)

```
Request: GET /api/search?q=laptop (sin token)
Response: 200 OK
{
  "results": [
    { "name": "Laptop X", "price": 999 },
    ...
  ]
}
```

### Caso 2: Acceso a historial SIN autenticación (Error)

```
Request: GET /api/v1/products/ABC123/priceHistory (sin token)
Response: 401 Unauthorized
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

**Manejo en extensión:**
```javascript
if (response.status === 401) {
    console.warn('Token no válido - usuario debe autenticarse');
    // Sugerir al usuario hacer login
    return null;
}
```

### Caso 3: Token expirado (JWT inválido)

```
Request: GET /api/v1/products/ABC123/alert (con token expirado)
Response: 403 Forbidden
{
  "error": "Invalid JWT",
  "message": "Token has expired"
}
```

**Manejo en extensión:**
```javascript
// Limpiar token expirado
await firebaseAuthService.logout();
console.warn('Token expirado - por favor vuelve a autenticarte');
```

---

## Testing Manual

### Escenario 1: Sin hacer login

1. Abre Chrome DevTools (F12 en Google Search)
2. Busca algo en Google
3. Verifica logs:
   ```
   [INTENT] Usuario no autenticado - búsqueda gratis sin perfil
   [INTENT] ✓ BUY
   ```
4. Verificar request en Network:
   - NO tiene header `Authorization` ✅

### Escenario 2: Después de hacer login

1. Click en icono de extensión
2. Ingresa email + contraseña
3. Click "Iniciar sesión" ✅
4. Busca algo en Google
5. Verifica logs:
   ```
   [INTENT] Token de Firebase obtenido (usuario autenticado)
   [INTENT] ✓ BUY
   ```
6. Verificar request en Network:
   - Header `Authorization: Bearer eyJhbGc...` ✅

---

## Resumen: ¿Qué cambió?

| Aspecto | Antes | Ahora |
|---------|--------|--------|
| Login requerido | ❌ Sí, obligatorio | ✅ Opcional |
| Búsqueda sin auth | ❌ No funciona | ✅ Funciona (gratis) |
| Historial/Alertas | ❌ - | ✅ Solo con auth |
| Token en header | ✅ Siempre enviado | ✅ Solo si existe |
| `/api/intent/intent` | ❌ Protegido | ✅ Público |
| `/api/v1/products/*` | ❌ Protegido | ✅ Protegido (correcto) |

---

## Próximos Pasos

1. **Backend**: Remover `@PreAuthorize` de `/api/intent/intent` y `/api/search`
2. **Backend**: Mantener `@PreAuthorize` en endpoints de `/api/v1/products/*`
3. **Testing**: Verificar que búsquedas funcionan sin token
4. **Testing**: Verificar que alertas retornan 401 sin token
5. **Frontend**: Ya está listo - maneja ambos casos
