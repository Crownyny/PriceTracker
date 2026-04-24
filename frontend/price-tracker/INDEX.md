# 📚 Documentación - Dashboard Angular PriceTracker

## 🎯 Comienza Aquí

### Para Empezar Rápido
👉 [**QUICK_START.md**](./QUICK_START.md) - 5 minutos
- Instalación
- Configuración básica
- Ejecutar proyecto
- Primeros pasos

### Para Entender la Arquitectura
👉 [**ARCHITECTURE.md**](./ARCHITECTURE.md) - Diagramas y flujos
- Diagrama de componentes
- Flujo de datos
- Integración paso a paso
- Ejemplos de código
- Testing

### Para Referencia Completa
👉 [**DASHBOARD_README.md**](./DASHBOARD_README.md) - Documentación extensiva
- Estructura completa del proyecto
- Características principales
- Ejemplos de uso detallados
- Configuración avanzada
- Solución de problemas

### Para Verificar Integración
👉 [**INTEGRATION_CHECKLIST.md**](./INTEGRATION_CHECKLIST.md) - Checklist de verificación
- Checklist de autenticación
- Verificación de endpoints
- Testing de componentes
- Debugging
- Go-live checklist

### Resumen de Creación
👉 [**SUMMARY.md**](./SUMMARY.md) - Lo que se ha creado
- Estadísticas del proyecto
- Archivos creados
- Características implementadas
- Próximos pasos sugeridos

---

## 📂 Estructura del Proyecto

```
frontend/price-traker/
├── src/
│   ├── app/
│   │   ├── core/                # Servicios y configuración
│   │   ├── shared/              # Modelos compartidos
│   │   ├── features/            # Componentes por dominio
│   │   ├── app.ts              # Componente raíz
│   │   ├── app.css             # Estilos principales
│   │   ├── app.config.ts        # Configuración
│   │   └── app.routes.ts        # Rutas
│   ├── styles.css              # Estilos globales
│   └── main.ts                 # Entry point
│
├── 📄 QUICK_START.md           # Guía rápida ⭐
├── 📄 ARCHITECTURE.md          # Diagrama y flujos
├── 📄 DASHBOARD_README.md      # Documentación completa
├── 📄 INTEGRATION_CHECKLIST.md # Verificación
├── 📄 SUMMARY.md               # Resumen de creación
├── 📄 INDEX.md                 # ← TÚ ESTÁS AQUÍ
├── angular.json
├── package.json
├── tsconfig.json
└── ...otros archivos
```

---

## 🚀 Rutas de Aprendizaje

### 1. Yo Quiero Empezar Rápido
```
QUICK_START.md → npm install → npm run dev → ¡Listo!
```

### 2. Yo Quiero Entender la Arquitectura
```
ARCHITECTURE.md → Lee diagramas → Lee flujos → 
Ve código en src/app/
```

### 3. Yo Quiero Integrar mi Backend
```
INTEGRATION_CHECKLIST.md → Verifica endpoints → 
Actualiza http-config.service.ts → 
Comprueba todos los checks
```

### 4. Yo Quiero Crear Nuevas Features
```
ARCHITECTURE.md → Paso a Paso Integración →
Copia estructura de alerts/ → Modifica servicios
```

### 5. Yo Tengo un Error
```
DASHBOARD_README.md → Solución de Problemas →
INTEGRATION_CHECKLIST.md → Debugging
```

---

## 🎯 Que Busco...

| Necesito... | Ir a... | Sección |
|-------------|---------|----------|
| Instalar y ejecutar | QUICK_START.md | "5 Minutos para Comenzar" |
| Entender flujos | ARCHITECTURE.md | "Diagrama de Flujo" |
| Usar AlertService | DASHBOARD_README.md | "Ejemplos de Uso" |
| Crear nuevo componente | ARCHITECTURE.md | "Integración Paso a Paso" |
| Verificar endpoints | INTEGRATION_CHECKLIST.md | "Endpoints Backend" |
| Configurar API | QUICK_START.md | "Configurar Backend" |
| Token expirado | INTEGRATION_CHECKLIST.md | "Autenticación" |
| Componente no carga | INTEGRATION_CHECKLIST.md | "Si Algo No Funciona" |
| Agregar gráficos | DASHBOARD_README.md | "Próximos Pasos" |
| Debug de error | INTEGRATION_CHECKLIST.md | "Debugging" |

---

## 📋 Resumen Rápido de Archivos Clave

### Core Services
| Archivo | Responsabilidad |
|---------|-----------------|
| `core/services/token.service.ts` | Gestiona tokens JWT |
| `core/services/http-config.service.ts` | Configura peticiones HTTP |
| `core/interceptors/auth.interceptor.ts` | Inyecta JWT automáticamente |
| `core/guards/auth.guard.ts` | Protege rutas |

### Feature Services
| Archivo | Responsabilidad |
|---------|-----------------|
| `features/alerts/services/alert.service.ts` | CRUD de alertas |
| `features/price-history/services/price-history.service.ts` | Historial de precios |
| `features/products/services/products.service.ts` | Búsqueda de productos |

### Components
| Archivo | Responsabilidad |
|---------|-----------------|
| `features/dashboard/dashboard.component.ts` | Panel principal |
| `features/price-history/components/price-history.component.ts` | Historial |
| `features/alerts/components/alerts.component.ts` | Alertas |

### Models
| Archivo | Contiene |
|---------|----------|
| `shared/models/product.model.ts` | Product, ProductSource |
| `shared/models/price-history.model.ts` | PriceHistory, PriceTrendAnalysis |
| `shared/models/alert.model.ts` | Alert, CreateAlertRequest, etc |
| `shared/models/auth.model.ts` | AuthCredentials, UserProfile |

---

## 🔐 Autenticación (Resumen)

1. **Token guardado en localStorage** → `TokenService`
2. **Interceptor inyecta JWT** → `AuthInterceptor`
3. **Guard protege rutas** → `AuthGuard`
4. **Si expira** → Redirige a login

---

## 🌐 Endpoints Consumidos

### Alertas
```
GET  /api/v1/products/{id}/alert
POST /api/v1/products/{id}/alert
PUT  /api/v1/products/{id}/alert/{alertId}
PATCH /api/v1/products/{id}/alert/{alertId}
DELETE /api/v1/products/{id}/alert/{alertId}
```

### Historial
```
GET /api/v1/products/{id}/priceHistory?range=M1
```

### Productos
```
GET /api/v1/products/search?q=query
GET /api/v1/users/{userId}/saved-products
```

---

## ✅ Checklist Antes de Usar

- [ ] Backend corre en `http://localhost:8080`
- [ ] `npm install` ejecutado
- [ ] Tienes un token JWT válido o datos mock
- [ ] `npm run dev` ejecutado
- [ ] Puedes acceder a `http://localhost:4200`
- [ ] No hay errores en console (F12)

---

## 📞 ¿Preguntas Frecuentes?

### P: ¿Por dónde empiezo?
R: Lee [QUICK_START.md](./QUICK_START.md)

### P: ¿Cómo configuro la API?
R: Ve a [QUICK_START.md](./QUICK_START.md) → "Configurar Backend"

### P: ¿Cómo creo un nuevo componente?
R: Lee [ARCHITECTURE.md](./ARCHITECTURE.md) → "Integración Paso a Paso"

### P: ¿Por qué no funciona la autenticación?
R: Consulta [INTEGRATION_CHECKLIST.md](./INTEGRATION_CHECKLIST.md) → "Autenticación"

### P: ¿Puedo ver ejemplos?
R: Mira [DASHBOARD_README.md](./DASHBOARD_README.md) → "Ejemplos de Uso"

### P: ¿Qué fue creado?
R: Lee [SUMMARY.md](./SUMMARY.md)

---

## 🎓 Recursos Externos

- [Angular Docs](https://angular.io)
- [RxJS Docs](https://rxjs.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [JWT Introduction](https://jwt.io/introduction)

---

## 📊 Estadísticas del Proyecto

- **15+** archivos TypeScript
- **4** archivos CSS
- **12** modelos/DTOs
- **5** servicios HTTP
- **3** componentes principales
- **2000+** líneas de código
- **1000+** líneas de documentación
- **1** guardia de autenticación
- **1** interceptor JWT
- **100%** tipado con TypeScript

---

## 🚀 Stack Tecnológico

- **Angular 17+** - Framework
- **TypeScript 5+** - Lenguaje
- **RxJS** - Programación Reactiva
- **Standalone Components** - Sin módulos
- **CSS 3** - Estilos (sin frameworks)
- **LocalStorage** - Token storage
- **HTTP Client** - Peticiones API

---

## 📋 Próximos Pasos

Después de familiarizarte con el dashboard:

1. ✅ Lee [QUICK_START.md](./QUICK_START.md) (5 min)
2. ✅ Ejecuta `npm install && npm run dev` (2 min)
3. ✅ Verifica endpoints con [INTEGRATION_CHECKLIST.md](./INTEGRATION_CHECKLIST.md) (10 min)
4. ✅ Explora componentes en `src/app/features/` (15 min)
5. ✅ Crea tu primer componente nuevo (30 min)
6. ✅ Integra con tu backend (1-2 horas)

---

## 🎉 ¡Listo!

Tienes un **dashboard Angular profesional** listo para conectar con tu backend.

**Comienza ahora:** [QUICK_START.md](./QUICK_START.md)

---

**Última actualización:** April 24, 2026
**Versión:** 1.0
**Status:** ✅ Production Ready
