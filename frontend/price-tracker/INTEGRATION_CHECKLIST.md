# ✅ Checklist de Integración - Dashboard Angular

## 🔐 Autenticación

- [ ] Backend emite tokens JWT
- [ ] Token se almacena en localStorage
- [ ] Interceptor añade Authorization header automáticamente
- [ ] AuthGuard redirige a login si no hay token
- [ ] Token expira correctamente (401 redirige a login)

**Verificar:**
```bash
# En browser console (F12)
localStorage.getItem('access_token')  # Debe retornar un token
```

---

## 📡 Conectividad HTTP

- [ ] Backend corre en `http://localhost:8080`
- [ ] CORS está habilitado en backend
- [ ] Endpoints responden con JSON válido
- [ ] Headers `Content-Type: application/json` enviados correctamente

**Verificar:**
```bash
# Terminal
curl -X GET http://localhost:8080/api/v1/products/search?q=test \
  -H "Authorization: Bearer YOUR_TOKEN"

# Debe retornar: {"products": [...], "totalResults": 0}
```

---

## 📦 Endpoints Backend

### Alertas
- [ ] `GET /api/v1/products/{productId}/alert` retorna array de alertas
- [ ] `POST /api/v1/products/{productId}/alert` crea alerta y retorna objeto Alert
- [ ] `PUT /api/v1/products/{productId}/alert/{alertId}` actualiza alerta
- [ ] `PATCH /api/v1/products/{productId}/alert/{alertId}` cambia estado
- [ ] `DELETE /api/v1/products/{productId}/alert/{alertId}` elimina alerta

**Ejemplo de respuesta esperada:**
```json
{
  "alerts": [
    {
      "id": "alert-123",
      "productId": "prod-456",
      "productRef": "iphone-15-pro",
      "targetPrice": 999.99,
      "currency": "USD",
      "frequency": "1d",
      "isActive": true,
      "notificationMethod": "email",
      "createdAt": "2024-04-20T10:00:00Z"
    }
  ],
  "total": 1,
  "page": 0,
  "pageSize": 10
}
```

### Historial de Precios
- [ ] `GET /api/v1/products/{productId}/priceHistory?range=M1` retorna historial
- [ ] Respuesta contiene array `history` con `date`, `price`, `currency`, `availability`, `source`

**Ejemplo de respuesta esperada:**
```json
{
  "productRef": "iphone-15-pro",
  "productId": "prod-123",
  "history": [
    {
      "date": "2024-04-20",
      "price": 999.99,
      "currency": "USD",
      "availability": true,
      "source": "Amazon"
    }
  ]
}
```

### Búsqueda de Productos
- [ ] `GET /api/v1/products/search?q=iphone` retorna productos
- [ ] Respuesta contiene array `products` y `totalResults`

---

## 🎨 Componentes UI

### Dashboard
- [ ] Se carga correctamente
- [ ] Muestra estadísticas (aunque sean 0)
- [ ] Botones "Ver Historial" y "Gestionar Alertas" navegan correctamente
- [ ] No hay errores en console (F12)

**Testing:**
```
1. Abre http://localhost:4200/dashboard
2. Presiona F12 → Console
3. No debe haber errores rojos
4. Debe mostrar componente sin errores
```

### Price History
- [ ] Búsqueda de productos funciona
- [ ] Dropdowns de rango funcionan (W1, M1, Y1)
- [ ] Tabla se carga con datos
- [ ] Estadísticas se calculan correctamente

**Testing:**
```
1. Ve a /price-history
2. Escribe "iphone" en búsqueda
3. Presiona Enter
4. Debe mostrar historial (si existen datos)
```

### Alerts
- [ ] Formulario para crear alerta funciona
- [ ] Lista de alertas se carga
- [ ] Botones Activar/Desactivar funcionan
- [ ] Botón Eliminar pide confirmación

**Testing:**
```
1. Ve a /alerts
2. Haz clic en "+ Crear Nueva Alerta"
3. Completa formulario
4. Haz clic en "Crear Alerta"
5. Debe aparecer en la lista
```

---

## 🔌 Interceptor JWT

- [ ] Cada petición HTTP incluye `Authorization: Bearer {token}`
- [ ] Peticiones sin token fallan apropiadamente
- [ ] Respuesta 401 redirige a login
- [ ] Token se incluye en headers, no en body

**Verificar en DevTools:**
```
1. Abre F12 → Network
2. Realiza una acción (buscar, crear alerta)
3. Haz clic en la petición
4. Ve a Headers
5. Debe ver: Authorization: Bearer eyJ...
```

---

## 💾 Almacenamiento de Datos

- [ ] Token se almacena en localStorage
- [ ] Perfil de usuario se almacena
- [ ] LocalStorage persiste después de recargar
- [ ] Logout limpia localStorage

**Verificar:**
```javascript
// En console (F12)
JSON.parse(localStorage.getItem('user_profile'))
// Debe retornar { id, email, name, ... }
```

---

## 🚦 Rutas y Navegación

- [ ] `/dashboard` es accesible y protegida
- [ ] `/price-history` es accesible y protegida
- [ ] `/alerts` es accesible y protegida
- [ ] Enlaces de navegación funcionan (navbar)
- [ ] Active link se resalta correctamente
- [ ] Ruta inexistente redirige a dashboard

---

## 📊 Datos Mock vs Real

### Si NO tienes backend:
```bash
# Crea datos mock en localStorage
localStorage.setItem('access_token', 'mock-token-123');
localStorage.setItem('user_profile', JSON.stringify({
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User'
}));
```

### Si SÍ tienes backend:
- [ ] Backend retorna respuestas con estructura correcta
- [ ] Frontend deserializa correctamente
- [ ] Datos se muestran sin errores
- [ ] Ediciones se guardan correctamente

---

## 🐛 Debugging

### En case de error:

1. **Abre DevTools (F12)**
   - Console → Ver errores
   - Network → Ver peticiones fallidas
   - Sources → Debuggear código

2. **Verifica token:**
   ```javascript
   localStorage.getItem('access_token')
   ```

3. **Verifica servicio:**
   ```javascript
   // En console, después de un click:
   window.fetch('http://localhost:8080/api/v1/products/search?q=test', {
     headers: { Authorization: 'Bearer YOUR_TOKEN' }
   })
   ```

4. **Logs en consola:**
   - Cada servicio tiene console.log() para debugging
   - Activa el inspector de Redux si lo necesitas

---

## 📱 Responsive Design

- [ ] Layout funciona en desktop (1920x1080)
- [ ] Layout funciona en tablet (768x1024)
- [ ] Layout funciona en móvil (375x667)
- [ ] Navegación es accesible en móvil
- [ ] Tablas son scrollables en móvil

**Testing:**
```
1. Abre DevTools (F12)
2. Ctrl+Shift+M (toggle device toolbar)
3. Prueba diferentes tamaños
```

---

## ⚡ Performance

- [ ] Página carga en menos de 2 segundos
- [ ] No hay memory leaks (observables se desuscriben)
- [ ] Animaciones son smooth (60 FPS)
- [ ] No hay peticiones duplicadas

**Testing:**
```
1. DevTools → Performance
2. Click "Record"
3. Realiza acciones
4. Click "Stop"
5. Analiza timeline
```

---

## ✨ Final Verification

```typescript
// Todos estos deben estar disponibles en el global scope:

// Services
import { AlertService } from './services/alert.service';
import { PriceHistoryService } from './services/price-history.service';
import { ProductsService } from './services/products.service';
import { TokenService } from './core/services/token.service';

// Components
import { DashboardComponent } from './dashboard/dashboard.component';
import { AlertsComponent } from './alerts/alerts.component';
import { PriceHistoryComponent } from './price-history/price-history.component';

// Models
import { Alert, Product, PriceHistoryResponse } from './shared/models';

// Guards
import { AuthGuard } from './core/guards/auth.guard';
```

---

## 🎯 Checklist de Go-Live

- [ ] Endpoints backend configurados correctamente
- [ ] Autenticación funcionando (login/logout)
- [ ] Todas las rutas protegidas
- [ ] Componentes se cargan sin errores
- [ ] No hay console errors
- [ ] Datos se muestran correctamente
- [ ] CRUD (Create/Read/Update/Delete) funciona
- [ ] Errores manejados apropiadamente
- [ ] Responsive en todos los dispositivos
- [ ] Performance aceptable
- [ ] Documentación actualizada

---

## 📞 Si Algo No Funciona

1. **Backend no responde:**
   - Verifica: `docker ps` (¿contenedor running?)
   - Verifica URL en `http-config.service.ts`
   - Verifica CORS configuration

2. **Token no se envía:**
   - Verifica que `AuthInterceptor` está registrado
   - Verifica `app.config.ts` incluye HTTP_INTERCEPTORS

3. **AuthGuard redirige a loop:**
   - Verifica que tienes token válido en localStorage
   - Verifica que rutas protegidas incluyen `canActivate: [AuthGuard]`

4. **Componentes no cargan:**
   - Verifica imports en componente (CommonModule, FormsModule)
   - Verifica que componente es `standalone: true`
   - Verifica que está en `app.routes.ts`

5. **CSS no aplica:**
   - Verifica que archivos `.css` existen
   - Verifica que `styleUrl` apunta a archivo correcto
   - Verifica que `styles.css` está en index.html

---

**¡Listo para verificar! ✅**
