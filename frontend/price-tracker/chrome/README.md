# Price Tracker - Chrome Extension

Esta es la extensión de Chrome para el proyecto Price Tracker.

## Estructura de Archivos

```
chrome/
├── manifest.json          # Configuración principal de la extensión
├── popup.html            # HTML del popup (activar/desactivar)
├── popup.css             # Estilos del popup
├── popup.js              # Lógica del popup
├── background.js         # Service Worker (background script)
├── content.js            # Script que se inyecta en las páginas web
├── content.css           # Estilos para el overlay de precios
├── dashboard.html        # Dashboard temporal (será reemplazado por Angular)
├── icons/                # Iconos de la extensión (pendiente)
└── README.md             # Este archivo
```

## Instalación para Desarrollo

1. Abre Chrome y ve a `chrome://extensions/`
2. Activa el **Modo de desarrollador** (esquina superior derecha)
3. Haz clic en **Cargar extensión sin empaquetar**
4. Selecciona la carpeta `chrome/`
5. ¡La extensión estará cargada!

## Funcionalidad Actual

### Popup (popup.html/js/css)
- ✅ Toggle para activar/desactivar la extensión
- ✅ Botón para abrir el dashboard
- ✅ Estado persistente usando chrome.storage
- ✅ Diseño moderno con gradientes

### Background Script (background.js)
- ✅ Service Worker que gestiona el estado global
- ✅ Comunicación entre popup y content scripts
- ✅ Sistema de mensajería para eventos
- ✅ Preparado para conectar con el backend
- 🔜 Integración con APIs del backend

### Content Script (content.js/css)
- ✅ Se inyecta en todas las páginas web
- ✅ Detecta búsquedas en Google
- ✅ Muestra overlay con resultados de precios
- ✅ Diseño responsive del overlay
- 🔜 Detectar más motores de búsqueda
- 🔜 Integración con modelo de detección de productos
