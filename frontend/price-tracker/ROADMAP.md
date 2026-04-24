# 🗺️ Hoja de Ruta - Dashboard Angular PriceTracker

## 📌 Donde Estamos

✅ **Dashboard Angular creado y listo**

```
┌─────────────────────────────────────────┐
│   DASHBOARD ANGULAR                     │
│   ├─ Dashboard (stats)                  │
│   ├─ Price History (gráficos)           │
│   └─ Alerts (CRUD)                      │
└─────────────────────────────────────────┘
                    ↓
        [AQUI ESTAMOS AHORA]
                    ↓
┌─────────────────────────────────────────┐
│   BACKEND SPRING BOOT                   │
│   ├─ API Endpoints ✓                    │
│   ├─ Database ✓                         │
│   └─ RabbitMQ ✓                         │
└─────────────────────────────────────────┘
```

---

## 🎯 Próximos 3 Pasos

### PASO 1️⃣: Instalar y Ejecutar (15 minutos)

```bash
# Terminal
cd frontend/price-traker
npm install
npm run dev
```

✅ Resultado: Dashboard corriendo en `http://localhost:4200`

**Verificar:**
- [ ] No hay errores en console (F12)
- [ ] Navbar visible
- [ ] Rutas: /dashboard, /alerts, /price-history

---

### PASO 2️⃣: Conectar con Backend (30 minutos)

**Opción A: Si tu backend está en `http://localhost:8080`**
```
✅ Ya está configurado
No necesitas cambios
```

**Opción B: Si tu backend está en otra URL**
```typescript
// Edita: src/app/core/services/http-config.service.ts
private readonly API_BASE_URL = 'http://tu-url:puerto/api';
```

**Opción C: Si no tienes backend aún**
```javascript
// Simula con localStorage (en browser console F12)
localStorage.setItem('access_token', 'mock-token-123');
localStorage.setItem('user_profile', JSON.stringify({
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User'
}));
```

✅ Resultado: Dashboard conectado a tu API

**Verificar:**
- [ ] F12 → Network → Peticiones van a tu backend
- [ ] Headers contienen `Authorization: Bearer ...`
- [ ] Respuestas son válidas

---

### PASO 3️⃣: Verificar Funcionalidad (30 minutos)

**1. Dashboard**
```
/dashboard → Debe mostrar sin errores
```

**2. Price History**
```
/price-history → Busca un producto → Debe mostrar historial
```

**3. Alerts**
```
/alerts → Crea una alerta → Debe aparecer en lista
         → Edita alerta → Cambios se guardan
         → Elimina alerta → Se quita de lista
```

✅ Resultado: Todas las funciones funcionan

**Verificar con Checklist:**
👉 Abre [INTEGRATION_CHECKLIST.md](./INTEGRATION_CHECKLIST.md)
Marca todos los checks ✓

---

## 📚 Documentación de Referencia

| Documento | Cuándo leerlo | Duración |
|-----------|--------------|----------|
| [QUICK_START.md](./QUICK_START.md) | Antes de comenzar | 5 min |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Para entender estructura | 15 min |
| [DASHBOARD_README.md](./DASHBOARD_README.md) | Para referencia completa | 30 min |
| [INTEGRATION_CHECKLIST.md](./INTEGRATION_CHECKLIST.md) | Para verificar | 20 min |
| [SUMMARY.md](./SUMMARY.md) | Para ver lo creado | 10 min |

---

## 🔧 Modificaciones Comunes

### Cambiar colores
```css
/* src/styles.css */
:root {
  --primary-color: #667eea;  ← Cambiar aquí
  --danger: #c53030;
  --success: #2e7d32;
}
```

### Agregar nuevo endpoint
```typescript
// src/app/features/my-feature/services/my-feature.service.ts
export class MyFeatureService {
  constructor(private http: HttpConfigService) {}
  
  getData() {
    return this.httpConfig.get<MyData>('/my-endpoint');
  }
}
```

### Crear nuevo componente
```bash
1. Crea carpeta: src/app/features/my-feature/components/
2. Copia estructura de alerts/ como template
3. Modifica servicios para tu endpoint
4. Agrega ruta en app.routes.ts
5. Agrega link en app.ts navbar
```

---

## 🚀 Plan de Trabajo (Opcional)

### Semana 1: Integración Básica
- [ ] Day 1: Instalar y ejecutar
- [ ] Day 2: Conectar backend
- [ ] Day 3: Verificar endpoints
- [ ] Day 4-5: Testing manual

### Semana 2: Enhancements
- [ ] Agregar gráficos de precios (Chart.js)
- [ ] Mejorar paginación
- [ ] Agregar filtros avanzados

### Semana 3: Producción
- [ ] Tests unitarios
- [ ] Deploy a servidor
- [ ] Monitoreo

---

## 📊 Arquitectura Visual

```
┌─────────────────────────────────────────────────────┐
│              USUARIO (Browser)                      │
└────────────────┬────────────────────────────────────┘
                 │ HTTP + JWT Token
                 ↓
┌─────────────────────────────────────────────────────┐
│         DASHBOARD ANGULAR (Frontend)                │
│                                                     │
│  ┌──────────────┬──────────────┬──────────────┐    │
│  │  Dashboard   │ Price Hist.  │   Alerts     │    │
│  └──────────────┴──────────────┴──────────────┘    │
│          ↓           ↓               ↓              │
│  ┌────────────────────────────────────────┐        │
│  │     Servicios HTTP (Tipados)          │        │
│  │  - AlertService                       │        │
│  │  - PriceHistoryService                │        │
│  │  - ProductsService                    │        │
│  └────────────────────────────────────────┘        │
│          ↓           ↓               ↓              │
│  ┌────────────────────────────────────────┐        │
│  │  AuthInterceptor (JWT automático)     │        │
│  │  HttpConfigService (Config)           │        │
│  │  TokenService (Storage)                │        │
│  └────────────────────────────────────────┘        │
└─────────────────────┬──────────────────────────────┘
                     │ API REST
                     ↓
┌─────────────────────────────────────────────────────┐
│      BACKEND SPRING BOOT (http://localhost:8080)    │
│                                                     │
│  /api/v1/products/{id}/alert                        │
│  /api/v1/products/{id}/priceHistory                 │
│  /api/v1/products/search                            │
│                                                     │
└────────────────┬───────────────────────────────────┘
                 │ RabbitMQ
                 ↓
      ┌──────────────────────┐
      │ Microservicios (Py)  │
      │ - Scraper            │
      │ - Normalizer         │
      └──────────────────────┘
```

---

## ✨ Features Incluidas

| Feature | Estado | Documento |
|---------|--------|-----------|
| Dashboard con stats | ✅ | DASHBOARD_README.md |
| Price History | ✅ | DASHBOARD_README.md |
| Alertas CRUD | ✅ | DASHBOARD_README.md |
| Autenticación JWT | ✅ | ARCHITECTURE.md |
| Interceptor HTTP | ✅ | ARCHITECTURE.md |
| Route Guards | ✅ | ARCHITECTURE.md |
| TypeScript Tipos | ✅ | SUMMARY.md |
| Responsive Design | ✅ | DASHBOARD_README.md |
| Documentación | ✅ | INDEX.md |

---

## 🎯 Métricas de Éxito

**Después de seguir esta hoja de ruta:**

- ✅ Dashboard corriendo localmente
- ✅ Conectado a tu backend
- ✅ Autenticación funcionando
- ✅ Componentes cargan datos reales
- ✅ CRUD funciona correctamente
- ✅ Sin errores en console
- ✅ Responsive en mobile/tablet/desktop

---

## 📞 Troubleshooting Rápido

**Problem:** Dashboard no carga
```
Solución: Abre F12 → Console → busca errores rojos
```

**Problem:** Backend no responde
```
Solución: Verifica docker ps, http-config.service.ts URL
```

**Problem:** Token no se envía
```
Solución: Verifica AuthInterceptor está en app.config.ts
```

---

## 🎓 Aprendizaje Máximo

Mientras completas la hoja de ruta, aprenderás:

✅ Angular 17+ Architecture
✅ Standalone Components
✅ TypeScript Advanced Types
✅ RxJS Reactive Programming
✅ HTTP Interceptors
✅ JWT Authentication
✅ REST API Integration
✅ Component Design Patterns
✅ Responsive CSS
✅ Clean Code Principles

---

## 🚀 ¡Comienza Ahora!

### Paso 1: Lee QUICK_START.md
👉 [QUICK_START.md](./QUICK_START.md)

### Paso 2: Ejecuta
```bash
npm install && npm run dev
```

### Paso 3: Verifica
👉 [INTEGRATION_CHECKLIST.md](./INTEGRATION_CHECKLIST.md)

---

**Estimated Time to Completion:** 1-2 horas
**Difficulty Level:** Intermedio
**Requirements:** Node.js, npm, Backend corriendo

¡Buena suerte! 🎉

---

**Última actualización:** April 24, 2026
