# Dashboard Angular - PriceTracker

## 📁 Estructura del Proyecto

```
src/app/
├── core/                                    # Servicios y configuración singleton
│   ├── guards/
│   │   └── auth.guard.ts                   # Protege rutas autenticadas
│   ├── interceptors/
│   │   └── auth.interceptor.ts            # Inyecta token JWT automáticamente
│   └── services/
│       ├── token.service.ts                # Gestiona almacenamiento de tokens
│       └── http-config.service.ts          # Configuración base de HTTP
│
├── shared/                                  # Componentes y modelos compartidos
│   ├── models/
│   │   ├── product.model.ts               # Modelos de productos
│   │   ├── price-history.model.ts         # Modelos de historial de precios
│   │   ├── alert.model.ts                 # Modelos de alertas
│   │   └── auth.model.ts                  # Modelos de autenticación
│   └── components/                        # Componentes reutilizables (si hay)
│
├── features/                                # Features por dominio
│   ├── dashboard/
│   │   ├── dashboard.component.ts         # Componente principal
│   │   └── dashboard.component.css        # Estilos
│   │
│   ├── price-history/
│   │   ├── components/
│   │   │   ├── price-history.component.ts
│   │   │   └── price-history.component.css
│   │   └── services/
│   │       └── price-history.service.ts
│   │
│   ├── alerts/
│   │   ├── components/
│   │   │   ├── alerts.component.ts
│   │   │   └── alerts.component.css
│   │   └── services/
│   │       └── alert.service.ts
│   │
│   └── products/
│       ├── components/
│       └── services/
│           └── products.service.ts
│
├── app.config.ts                           # Configuración principal (providers)
├── app.routes.ts                          # Rutas de la aplicación
├── app.ts                                 # Componente raíz
└── app.css                                # Estilos globales

styles.css                                 # Estilos base y utilidades
```

---

## 🚀 Características Principales

### 1. **Autenticación JWT**
- Token automaticamente añadido a cada petición HTTP
- Token storage en localStorage
- Validación de token expirado
- Protección de rutas con AuthGuard

### 2. **Servicios HTTP Tipados**
- `AlertService` - Gestiona alertas de precios
- `PriceHistoryService` - Obtiene historial de precios
- `ProductsService` - Busca y gestiona productos

### 3. **Componentes Standalone**
Todos los componentes son standalone (no requieren módulos):

#### **Dashboard**
```typescript
// Muestra estadísticas principales y acciones rápidas
- Ahorro total
- Productos guardados
- Alertas activas
- Accesos rápidos a funciones principales
```

#### **Price History**
```typescript
// Visualiza historial de precios de un producto
- Búsqueda de productos
- Filtro por rango de tiempo
- Estadísticas: min, max, promedio
- Tabla con historial detallado
```

#### **Alerts**
```typescript
// Gestiona alertas de precios
- Crear nuevas alertas
- Listar alertas existentes
- Activar/desactivar alertas
- Eliminar alertas
- Editar parámetros
```

---

## 📝 Ejemplos de Uso

### Ejemplo 1: Usar AlertService

```typescript
import { Component, OnInit } from '@angular/core';
import { AlertService } from './services/alert.service';
import { Alert } from '../shared/models/alert.model';

@Component({
  selector: 'app-my-component',
  template: `...`
})
export class MyComponent implements OnInit {
  alerts: Alert[] = [];

  constructor(private alertService: AlertService) {}

  ngOnInit() {
    // Obtener alertas
    this.alertService.getAlerts('product-123').subscribe({
      next: (response) => {
        this.alerts = response.alerts;
      },
      error: (err) => {
        console.error('Error:', err);
      }
    });
  }

  // Crear alerta
  createAlert() {
    this.alertService.createAlert('product-123', {
      productId: 'product-123',
      targetPrice: 99.99,
      currency: 'USD',
      frequency: '1d',
      notificationMethod: 'email'
    }).subscribe({
      next: (response) => {
        console.log('Alerta creada:', response.alert);
      }
    });
  }

  // Cambiar estado
  toggleAlert(alert: Alert) {
    this.alertService.updateAlertStatus(alert.productId, alert.id, {
      isActive: !alert.isActive
    }).subscribe({
      next: () => {
        alert.isActive = !alert.isActive;
      }
    });
  }

  // Eliminar alerta
  deleteAlert(productId: string, alertId: string) {
    this.alertService.deleteAlert(productId, alertId).subscribe({
      next: () => {
        this.alerts = this.alerts.filter(a => a.id !== alertId);
      }
    });
  }
}
```

### Ejemplo 2: Usar PriceHistoryService

```typescript
import { Component, OnInit } from '@angular/core';
import { PriceHistoryService } from './services/price-history.service';
import { PriceHistoryResponse } from '../shared/models/price-history.model';

@Component({
  selector: 'app-my-component',
  template: `...`
})
export class MyComponent implements OnInit {
  priceData: PriceHistoryResponse | null = null;

  constructor(private priceHistoryService: PriceHistoryService) {}

  ngOnInit() {
    // Obtener historial de últimos 30 días
    this.priceHistoryService.getPriceHistory('product-123', 'M1')
      .subscribe({
        next: (response) => {
          this.priceData = response;
          console.log('Min price:', Math.min(...response.history.map(h => h.price)));
          console.log('Max price:', Math.max(...response.history.map(h => h.price)));
        }
      });
  }
}
```

### Ejemplo 3: Usar ProductsService

```typescript
import { Component } from '@angular/core';
import { ProductsService } from './services/products.service';
import { Product } from '../shared/models/product.model';

@Component({
  selector: 'app-my-component',
  template: `...`
})
export class MyComponent {
  products: Product[] = [];

  constructor(private productsService: ProductsService) {}

  searchProducts(query: string) {
    this.productsService.searchProducts(query).subscribe({
      next: (response) => {
        this.products = response.products;
      }
    });
  }

  getSavedProducts(userId: string) {
    this.productsService.getSavedProducts(userId, 0, 10)
      .subscribe({
        next: (response) => {
          this.products = response.products;
        }
      });
  }

  saveProduct(productId: string) {
    this.productsService.saveProduct(productId).subscribe({
      next: () => console.log('Producto guardado')
    });
  }
}
```

---

## 🔐 Autenticación

### Flujo de Autenticación

1. **Login**: Usuario proporciona credenciales
2. **Token Storage**: Token guardado en localStorage
3. **Auto-inyección**: AuthInterceptor añade token a cada petición
4. **Protección**: AuthGuard verifica token antes de acceder a rutas
5. **Refresh**: Si token expira (401), user es redirigido a login

### Usar Token Service

```typescript
import { TokenService } from './core/services/token.service';

@Component({...})
export class MyComponent {
  constructor(private tokenService: TokenService) {}

  login(email: string, password: string) {
    // Después de obtener token del backend:
    this.tokenService.setTokens(accessToken, refreshToken);
    this.tokenService.setUserProfile(user);
  }

  getUser() {
    return this.tokenService.getUserProfile();
  }

  logout() {
    this.tokenService.clearTokens();
  }

  isTokenExpired() {
    return this.tokenService.isTokenExpired();
  }
}
```

---

## 🌐 Configuración de API

Por defecto, la API está configurada en: `http://localhost:8080/api/v1`

Para cambiar el endpoint, edita [http-config.service.ts](./core/services/http-config.service.ts):

```typescript
private readonly API_BASE_URL = 'http://localhost:8080/api';
private readonly API_VERSION = 'v1';
```

---

## 📦 Instalación y Ejecución

### Instalar dependencias
```bash
cd frontend/price-traker
npm install
```

### Ejecutar en desarrollo
```bash
npm run dev
```

### Build para producción
```bash
npm run build
```

---

## 🎨 Estilos y Temas

### Variables CSS Globales

Definidas en `styles.css`:

```css
:root {
  --primary-color: #667eea;
  --primary-dark: #5568d3;
  --text-primary: #1a1a1a;
  --text-secondary: #666;
  --bg-light: #f9f9f9;
  --border-color: #e0e0e0;
  --success: #2e7d32;
  --danger: #c53030;
}
```

### Utilidades CSS Disponibles

```css
/* Flexbox */
.flex, .flex-col, .flex-center, .flex-between

/* Grid */
.grid, .grid-cols-1, .grid-cols-2, .grid-cols-3, .grid-cols-4

/* Spacing */
.mt-1, .mt-2, .mt-3, .mt-4  /* margin-top */
.mb-1, .mb-2, .mb-3, .mb-4  /* margin-bottom */
.p-1, .p-2, .p-3, .p-4      /* padding */

/* Shadows */
.shadow-sm, .shadow, .shadow-md, .shadow-lg

/* Rounded */
.rounded, .rounded-md, .rounded-lg, .rounded-xl, .rounded-full
```

---

## 🐛 Solución de Problemas

### Error: "No provider for HttpClient"
**Solución**: Asegúrate de que `provideHttpClient()` está en `app.config.ts`

### Error: "Cannot match any routes"
**Solución**: Verifica que las rutas están correctamente configuradas en `app.routes.ts`

### Token no se envía en peticiones
**Solución**: Verifica que AuthInterceptor está registrado en `app.config.ts`

### CORS error
**Solución**: Asegúrate de que el backend permite CORS desde `http://localhost:4200`

---

## 📚 Recursos

- [Angular Documentation](https://angular.io/docs)
- [RxJS Documentation](https://rxjs.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

## 🤝 Contribuir

1. Crea una rama: `git checkout -b feature/mi-feature`
2. Commit tus cambios: `git commit -am 'Add new feature'`
3. Push a la rama: `git push origin feature/mi-feature`
4. Abre un Pull Request

---

**Última actualización**: April 24, 2026
