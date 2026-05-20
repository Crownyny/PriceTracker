# Quick Start

## Dashboard Angular

```bash
cd frontend/price-tracker
npm install
npm start
```

Abre `http://localhost:4200`. Si el backend no está corriendo, la app carga igualmente pero las peticiones fallarán con errores de red — es el comportamiento esperado.

---

## Simular sesión sin backend

Si necesitas trabajar en el frontend sin el backend disponible, puedes inyectar un token y perfil manualmente en la consola del navegador (F12):

```js
localStorage.setItem('access_token', 'token-de-prueba');
localStorage.setItem('user_profile', JSON.stringify({
  id: 'user-123',
  email: 'dev@example.com',
  name: 'Dev'
}));
```

Recarga la página. El `AuthGuard` leerá el token y permitirá el acceso a las rutas protegidas. Las peticiones al backend seguirán fallando si no está activo.

---

## Cambiar la URL del backend

```typescript
// src/app/core/services/http-config.service.ts
private readonly API_BASE_URL = 'http://localhost:8080/api';
```

---

## Extensión Chrome

1. Abre `chrome://extensions/` y activa **Modo desarrollador**
2. **Cargar extensión sin empaquetar** → selecciona la carpeta `chrome/`
3. Crea `chrome/.env.local` con tus credenciales de Firebase (ver `chrome/REFACTOR_SECURITY.md`)

Para recargar la extensión después de cambios en `background.js` o `manifest.json`, haz clic en el ícono de recarga en `chrome://extensions/`. Los cambios en `content.js` se aplican al recargar la pestaña donde está activo.

---

## Debugging

**Dashboard:** DevTools del navegador → pestaña Network para ver peticiones HTTP, pestaña Application → Local Storage para ver el token y perfil guardados.

**Extensión background.js:** `chrome://extensions/` → clic en "Service Worker" bajo la extensión → abre DevTools del service worker.

**Extensión content.js:** DevTools de la pestaña donde está activa la extensión → consola normal.