# PriceTracker — Frontend

Frontend del sistema de comparación de precios en tiempo real. Tiene dos partes independientes:

- **Dashboard web** — app Angular 17 con historial de precios, alertas y gestión de cuenta
- **Extensión Chrome** — se inyecta en búsquedas de Google y muestra comparativas de precio en tiempo real

El backend, scraping, normalización y WebSockets son responsabilidad de otros servicios. Este repositorio solo cubre el frontend.

---

## Requisitos

- Node.js 22+
- npm 10+
- Angular CLI: `npm install -g @angular/cli`
- Chrome (para la extensión)

---

## Dashboard Angular

### Instalación

```bash
cd frontend/price-tracker
npm install
```

### Configuración

El dashboard conecta por defecto a `http://localhost:8080/api`. Si tu backend corre en otra URL, edita:

```typescript
// src/app/core/services/http-config.service.ts
private readonly API_BASE_URL = 'http://tu-backend/api';
```

### Ejecución

```bash
npm start        # levanta ng serve con generate:config previo
npm run build    # build de producción
npm test         # tests con Vitest
```

Abre `http://localhost:4200`.

### Rutas

| Ruta | Descripción | Auth |
|------|-------------|------|
| `/` | Landing page | No |
| `/login` | Inicio de sesión | No |
| `/register` | Registro | No |
| `/dashboard` | Panel principal | Sí |
| `/search` | Búsqueda de productos | Sí |
| `/product/:id` | Detalle de producto | Sí |
| `/price-history` | Historial de precios | Sí |
| `/alerts` | Gestión de alertas | Sí |
| `/saved` | Productos guardados | Sí |
| `/account` | Mi cuenta | Sí |
| `/documentation` | Documentación | Sí |

La autenticación usa Firebase + JWT. El token se guarda en `localStorage` bajo la clave `access_token`.

---

## Extensión Chrome

### Instalación para desarrollo

1. Abre `chrome://extensions/`
2. Activa **Modo desarrollador**
3. Clic en **Cargar extensión sin empaquetar**
4. Selecciona la carpeta `chrome/`

### Configuración de Firebase

Las credenciales de Firebase no se incluyen en el repositorio. Crea el archivo `chrome/.env.local`:

```
FIREBASE_API_KEY=tu_api_key
FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
FIREBASE_PROJECT_ID=tu-proyecto
FIREBASE_APP_ID=tu_app_id
```

`setup-dev-config.js` lo carga automáticamente al abrir DevTools en el service worker. Ver `chrome/REFACTOR_SECURITY.md` para el flujo completo.

### Estructura

```
chrome/
├── manifest.json          # Manifest V3
├── background.js          # Service worker — gestiona estado y relay de API
├── content.js             # Se inyecta en páginas web
├── popup.html/js/css      # UI del popup
├── content/               # Lógica del content script por capas
│   ├── application/       # Casos de uso
│   ├── domain/            # Modelos
│   ├── presentation/      # UI del overlay
│   ├── services/          # Servicios de dominio
│   └── transport/         # Relay HTTP y WebSocket
└── background/            # Lógica del service worker
```

Las peticiones HTTP desde el content script van siempre a través del service worker para evitar restricciones CORS de Manifest V3. Ver `chrome/CORS_SOLUTION.md`.

---

## Estructura del dashboard

```
src/app/
├── core/
│   ├── config/            # RuntimeConfigService
│   ├── guards/            # AuthGuard
│   ├── interceptors/      # AuthInterceptor (inyecta JWT)
│   └── services/          # TokenService, AuthService, UserRoleService...
├── shared/
│   ├── models/            # Interfaces y DTOs
│   └── utils/             # alert.utils.ts, chart.utils.ts
└── features/
    ├── dashboard/
    ├── alerts/
    ├── price-history/
    ├── products/
    ├── search/
    ├── saved-products/
    ├── account/
    ├── login/ register/ forgot-password/
    └── documentation/
```

---

## Documentación adicional

- `QUICK_START.md` — instalación y primeros pasos
- `ARCHITECTURE.md` — flujos de datos y decisiones de arquitectura
- `DASHBOARD_README.md` — referencia completa del dashboard
- `INTEGRATION_CHECKLIST.md` — checklist para conectar un backend
- `chrome/CORS_SOLUTION.md` — por qué existe el relay de API en la extensión
- `chrome/REFACTOR_SECURITY.md` — manejo de credenciales Firebase
- `chrome/content/AUTENTICACION_OPCIONAL.md` — autenticación opcional en la extensión