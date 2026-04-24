# 🔗 Arquitectura Angular - PriceTracker Dashboard

## Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Angular)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              app.routes.ts (Enrutamiento)               │   │
│  │  - /dashboard  → DashboardComponent                      │   │
│  │  - /alerts     → AlertsComponent                         │   │
│  │  - /price-history → PriceHistoryComponent               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │           COMPONENTES (Standalone)                      │   │
│  │  - DashboardComponent (muestra stats)                    │   │
│  │  - AlertsComponent (CRUD de alertas)                    │   │
│  │  - PriceHistoryComponent (historial)                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │            SERVICIOS HTTP (Typed)                       │   │
│  │  - AlertService       (GET/POST/PUT/PATCH/DELETE)       │   │
│  │  - PriceHistoryService (GET)                            │   │
│  │  - ProductsService    (GET/POST)                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │          INTERCEPTOR + CONFIGURACIÓN                    │   │
│  │  - AuthInterceptor (inyecta JWT)                        │   │
│  │  - HttpConfigService (construye URLs)                   │   │
│  │  - TokenService (gestiona storage)                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │          MODELOS/TYPES (TypeScript)                     │   │
│  │  - Product, Alert, PriceHistory                         │   │
│  │  - AuthCredentials, UserProfile                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                            ↓ HTTP
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (Spring Boot)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  POST   /api/v1/products/{productId}/alert                      │
│  GET    /api/v1/products/{productId}/alert                      │
│  PUT    /api/v1/products/{productId}/alert/{alertId}            │
│  PATCH  /api/v1/products/{productId}/alert/{alertId}            │
│  DELETE /api/v1/products/{productId}/alert/{alertId}            │
│  GET    /api/v1/products/{productId}/priceHistory?range=M1      │
│  GET    /api/v1/products/search?q=iphone                        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                            ↓ RabbitMQ
┌─────────────────────────────────────────────────────────────────┐
│                   MICROSERVICIOS (Python)                        │
├─────────────────────────────────────────────────────────────────┤
│  - scrapping-service (extrae datos)                              │
│  - normalization-service (normaliza)                             │
│  - model-product (clasificación)                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flujo de Datos: Crear Alerta

```
Usuario escribe en formulario
        ↓
[alertsComponent.createAlert()]
        ↓
this.alertService.createAlert(productId, request)
        ↓
httpConfig.post('/products/{id}/alert', request)
        ↓
AuthInterceptor añade header Authorization: Bearer {token}
        ↓
HttpClient.post() 
        ↓
Backend: POST /api/v1/products/{id}/alert
        ↓
✓ Alerta creada
        ↓
subscribe.next(response)
        ↓
this.alerts.push(response.alert)
        ↓
Template se actualiza (ngFor detecta cambio)
        ↓
Usuario ve alerta nueva en lista
```

---

## 📊 Flujo de Datos: Obtener Historial de Precios

```
Usuario selecciona rango (M1, W2, etc)
        ↓
[priceHistoryComponent.onRangeChange()]
        ↓
this.priceHistoryService.getPriceHistory(productId, 'M1')
        ↓
httpConfig.get('/products/{id}/priceHistory?range=M1')
        ↓
AuthInterceptor añade JWT
        ↓
Backend retorna: PriceHistoryResponse { history: [...] }
        ↓
subscribe.next(response)
        ↓
this.priceData = response
        ↓
Template calcula: getMinPrice(), getMaxPrice(), getAveragePrice()
        ↓
Tabla se renderiza con history[0..20]
        ↓
Usuario ve gráfico/tabla actualizado
```

---

## 🔐 Flujo de Autenticación

```
1. INICIO
   ├─ Usuario abre dashboard
   └─ AuthGuard verifica TokenService.hasToken()

2. SI NO HAY TOKEN
   ├─ TokenService.isTokenExpired() = true
   ├─ AuthGuard retorna false
   └─ Router redirige a /login

3. SI HAY TOKEN VÁLIDO
   ├─ AuthGuard retorna true
   ├─ Router permite acceso
   └─ Componente carga datos

4. PETICIÓN HTTP
   ├─ Component llama service.getAlerts()
   ├─ AuthInterceptor intercepta petición
   ├─ Obtiene token: TokenService.getToken()
   ├─ Añade header: Authorization: Bearer {token}
   └─ HttpClient envía petición

5. RESPUESTA 401 (TOKEN EXPIRADO)
   ├─ Backend retorna 401 Unauthorized
   ├─ AuthInterceptor lo captura
   ├─ Llama: TokenService.clearTokens()
   ├─ Router redirige a /login
   └─ Usuario debe reiniciar sesión
```

---

## 🎯 Integración Paso a Paso

### Paso 1: Crear Modelo
```typescript
// shared/models/my-feature.model.ts
export interface MyFeature {
  id: string;
  name: string;
  value: number;
}
```

### Paso 2: Crear Servicio
```typescript
// features/my-feature/services/my-feature.service.ts
import { Injectable } from '@angular/core';
import { HttpConfigService } from '../../../core/services/http-config.service';
import { MyFeature } from '../../../shared/models/my-feature.model';

@Injectable({ providedIn: 'root' })
export class MyFeatureService {
  constructor(private httpConfig: HttpConfigService) {}

  getFeatures(): Observable<MyFeature[]> {
    return this.httpConfig.get<MyFeature[]>('/my-features');
  }
}
```

### Paso 3: Crear Componente
```typescript
// features/my-feature/components/my-feature.component.ts
import { Component, OnInit } from '@angular/core';
import { MyFeatureService } from '../services/my-feature.service';
import { MyFeature } from '../../../shared/models/my-feature.model';

@Component({
  selector: 'app-my-feature',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div>
      <h2>Mi Feature</h2>
      <ul>
        <li *ngFor="let item of features">{{ item.name }}</li>
      </ul>
    </div>
  `
})
export class MyFeatureComponent implements OnInit {
  features: MyFeature[] = [];

  constructor(private service: MyFeatureService) {}

  ngOnInit() {
    this.service.getFeatures().subscribe(data => {
      this.features = data;
    });
  }
}
```

### Paso 4: Agregar Ruta
```typescript
// app.routes.ts
import { MyFeatureComponent } from './features/my-feature/components/my-feature.component';

export const routes: Routes = [
  { path: 'my-feature', component: MyFeatureComponent, canActivate: [AuthGuard] },
  // ...
];
```

### Paso 5: Agregar en Navegación
```typescript
// app.ts template
<a routerLink="/my-feature" routerLinkActive="active">Mi Feature</a>
```

---

## 🧪 Testing (Mocking)

Para mockear servicios en tests:

```typescript
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MyComponent } from './my.component';
import { MyService } from './my.service';

describe('MyComponent', () => {
  let component: MyComponent;
  let mockService: jasmine.SpyObj<MyService>;

  beforeEach(() => {
    mockService = jasmine.createSpyObj('MyService', ['getData']);
    mockService.getData.and.returnValue(of([{ id: '1', name: 'Test' }]));

    TestBed.configureTestingModule({
      imports: [MyComponent],
      providers: [{ provide: MyService, useValue: mockService }]
    });

    component = TestBed.createComponent(MyComponent).componentInstance;
  });

  it('should load data', () => {
    component.ngOnInit();
    expect(mockService.getData).toHaveBeenCalled();
  });
});
```

---

## 📦 Estructura de Respuestas

### Alert Response
```json
{
  "alert": {
    "id": "alert-123",
    "productId": "product-456",
    "targetPrice": 99.99,
    "currency": "USD",
    "frequency": "1d",
    "isActive": true,
    "notificationMethod": "email"
  },
  "message": "Alerta creada exitosamente"
}
```

### Price History Response
```json
{
  "productRef": "iphone-15-pro",
  "productId": "product-123",
  "history": [
    {
      "date": "2024-04-20",
      "price": 999.99,
      "currency": "USD",
      "availability": true,
      "source": "Amazon"
    },
    {
      "date": "2024-04-19",
      "price": 1099.99,
      "currency": "USD",
      "availability": true,
      "source": "Walmart"
    }
  ]
}
```

---

## 🚨 Manejo de Errores

```typescript
this.service.getData().subscribe({
  next: (data) => {
    // ✓ Éxito
    this.data = data;
  },
  error: (error) => {
    // ✗ Error
    if (error.status === 401) {
      // Token expirado (manejado por interceptor)
    } else if (error.status === 403) {
      // Permiso denegado
      this.error = 'No tienes permiso';
    } else if (error.status === 500) {
      // Error del servidor
      this.error = 'Error del servidor';
    }
  },
  complete: () => {
    // Completado (siempre se ejecuta)
    this.loading = false;
  }
});
```

---

## ✅ Checklist de Desarrollo

- [ ] Modelo creado en `shared/models/`
- [ ] Servicio creado en `features/*/services/`
- [ ] Componente creado en `features/*/components/`
- [ ] Ruta añadida en `app.routes.ts`
- [ ] Enlace navegación en `app.ts`
- [ ] Interceptor maneja autenticación
- [ ] Manejo de errores implementado
- [ ] Tests unitarios escritos
- [ ] Documentación actualizada

---

**Última actualización**: April 24, 2026
