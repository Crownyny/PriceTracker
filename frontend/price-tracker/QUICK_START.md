# 🚀 Quick Start - Dashboard Angular

## ⚡ 5 Minutos para Comenzar

### 1. Instalar
```bash
cd frontend/price-traker
npm install
```

### 2. Configurar Backend (opcional)
El dashboard intenta conectar a `http://localhost:8080/api/v1` por defecto.

Si tu backend está en otra URL, edita:
```typescript
// src/app/core/services/http-config.service.ts
private readonly API_BASE_URL = 'http://tu-backend-url/api';
```

### 3. Ejecutar
```bash
npm run dev
```

Abre: `http://localhost:4200`

---

## 🔑 Token de Autenticación

El dashboard requiere un token JWT. Para simularlo localmente:

```typescript
// En browser console (F12):
localStorage.setItem('access_token', 'tu-token-aqui');
localStorage.setItem('user_profile', JSON.stringify({
  id: 'user-123',
  email: 'user@example.com',
  name: 'Juan'
}));
```

Luego recarga la página.

---

## 📱 Rutas Disponibles

| Ruta | Descripción |
|------|------------|
| `/dashboard` | Panel principal con estadísticas |
| `/price-history` | Historial y análisis de precios |
| `/alerts` | Gestión de alertas |

---

## 🔗 Endpoints Esperados del Backend

El dashboard consume estos endpoints:

```
GET  /api/v1/products/{productId}/priceHistory?range=M1
GET  /api/v1/products/{productId}/alert?frequency=1d
POST /api/v1/products/{productId}/alert
PUT  /api/v1/products/{productId}/alert/{alertId}
PATCH /api/v1/products/{productId}/alert/{alertId}
DELETE /api/v1/products/{productId}/alert/{alertId}
GET  /api/v1/products/search?q=iphone
GET  /api/v1/users/{userId}/saved-products
```

---

## 💡 Ejemplos de Uso

### Buscar Productos
```typescript
import { ProductsService } from './services/products.service';

@Component({...})
export class MyComponent {
  constructor(private products: ProductsService) {}

  search(query: string) {
    this.products.searchProducts(query).subscribe(result => {
      console.log(result.products);
    });
  }
}
```

### Crear Alerta
```typescript
import { AlertService } from './services/alert.service';

this.alertService.createAlert('product-123', {
  productId: 'product-123',
  targetPrice: 99.99,
  currency: 'USD',
  frequency: '1d',
  notificationMethod: 'email'
}).subscribe(response => {
  console.log('Alerta creada:', response.alert);
});
```

### Obtener Historial de Precios
```typescript
import { PriceHistoryService } from './services/price-history.service';

this.priceHistory.getPriceHistory('product-123', 'M1')
  .subscribe(data => {
    console.log(data.history);
  });
```

---

## 🎨 Personalizar Colores

Los colores están en `src/styles.css`:

```css
:root {
  --primary-color: #667eea;  /* Color principal */
  --danger: #c53030;         /* Rojo */
  --success: #2e7d32;        /* Verde */
}
```

---

## 🐛 Debug

Activa logs en la consola (F12):

```typescript
// En cualquier servicio, añade:
console.log('Response:', response);
```

---

## 📚 Más Información

Ver [DASHBOARD_README.md](./DASHBOARD_README.md) para documentación completa.

---

**Listo para empezar 🎉**
