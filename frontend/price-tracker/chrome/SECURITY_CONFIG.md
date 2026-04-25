# Configuración de Firebase - Guía de Seguridad

## 🔒 Cambios de Seguridad Implementados

Las credenciales de Firebase **ya NO están hardcodeadas** en el código. Ahora se usan de 3 formas:

### 1️⃣ **Desarrollo Local** - Usando `.env.local`
Para desarrollo rápido, puedes usar un archivo `.env.local`:

```bash
# .env.local (NUNCA commitar este archivo)
FIREBASE_API_KEY=your_api_key_here
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789012
FIREBASE_APP_ID=1:123456789012:web:your-app-id
FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

**⚠️ MUY IMPORTANTE:**
- El archivo `.env.local` está en `.gitignore` - **NUNCA se sube a Git**
- Solo se usa en desarrollo
- En producción, no se carga

### 2️⃣ **Configuración Manual** - Via Popup

Si abre el popup y no hay configuración, verá un formulario:

```
┌─────────────────────────┐
│ Configurar Firebase     │
│ ─────────────────────── │
│ API Key:     [........] │
│ Auth Domain: [........] │
│ Project ID:  [........] │
│ ...                     │
│ [Guardar Configuración] │
└─────────────────────────┘
```

Ingresa tus credenciales y haz clic en "Guardar". Se guardan en `chrome.storage.sync` (seguro y sincronizado entre tus navegadores).

### 3️⃣ **Almacenamiento Seguro** - Chrome Storage

Las credenciales se guardan en `chrome.storage.sync`:
- ✅ Encriptadas por Chrome
- ✅ Sincronizadas entre dispositivos del mismo usuario
- ✅ No se exponen en el código fuente
- ✅ No se envían a servidores de terceros

---

## 📋 Pasos para Obtener Credenciales de Firebase

### Opción A: Proyecto Firebase Existente

1. Abre [Firebase Console](https://console.firebase.google.com)
2. Selecciona tu proyecto Firebase
3. Ve a **⚙️ Configuración del Proyecto**
4. Haz clic en **Tu App** (o agrega una si no existe)
5. Selecciona tu app web
6. Copia la configuración (aparecerá un bloque JSON como este):

```json
{
   "apiKey": "your_api_key_here",
   "authDomain": "your-project.firebaseapp.com",
   "projectId": "your-project-id",
   "storageBucket": "your-project.firebasestorage.app",
   "messagingSenderId": "123456789012",
   "appId": "1:123456789012:web:your-app-id",
  "measurementId": "G-K6601BQ4Q4"
}
```

7. Copia cada valor en el formulario del popup

### Opción B: Crear Nuevo Proyecto Firebase

1. Ve a https://console.firebase.google.com
2. Haz clic en **Crear Proyecto**
3. Ingresa un nombre (ej: "Price Tracker")
4. Completa el wizard
5. En el Dashboard, haz clic en **+ Agregar app** → **Web**
6. Sigue los pasos para registrar tu app
7. Copia la configuración mostrada

---

## 🔑 Flujo de Configuración

### Primera Vez:
```
1. Instalas la extensión
   ↓
2. Haces clic en el popup
   ↓
   ↓
4. Muestra formulario para ingresar credenciales
   ↓
5. Ingresas valores desde Firebase Console
   ↓
6. Haces clic "Guardar Configuración"
   ↓
7. Se guardan en chrome.storage.sync (encriptado)
   ↓
8. Panel de login está listo
```

### Siguientes Veces:
```
1. Haces clic en el popup
   ↓
2. La extensión carga configuración de storage
   ↓
3. Firebase SDK se inicializa con credenciales
   ↓
4. Ves panel de login / estado de autenticación
```

---

## 🛡️ Seguridad: Cómo Funcionan las Credenciales

### Antes (❌ Inseguro):
```javascript
// Credenciales visibles en el código
const config = {
  apiKey: "AIzaSy...",  // ❌ VISIBLE EN CÓDIGO
};
```

### Ahora (✅ Seguro):
// Credenciales en chrome.storage (encriptado)
→ chrome.storage.sync.get('firebaseConfig')
  ↓
- ✅ Sincronizadas entre dispositivos
- ✅ El usuario controla quién las ve

---

## 📝 Ciclo de Uso

### Desarrollo:

```bash
# 1. Crear/editar .env.local
cp .env.example .env.local
# Editar .env.local con tus credenciales reales

# 2. La extensión carga .env.local al iniciar
# (setup-dev-config.js lo hace automáticamente)

# 3. Credenciales se guardan en chrome.storage
# (Reload la extensión para aplicar cambios)
```

### Producción:

```bash
# 1. Usuario instala la extensión
# 2. Abre el popup
# 3. Completa el formulario con sus credenciales
# 4. Haz clic en "Guardar"
# 5. Extensión está lista
```

---

## 🔄 Cambiar Credenciales Después

### Opción 1: Actualizar via Popup

1. Abre el popup
2. Haz clic en "Editar Configuración" (si existe ese botón)
3. Completa los nuevos valores
4. Haz clic "Guardar"
5. Recarga la extensión

### Opción 2: Actualizar .env.local (Desarrollo)

1. Edita `.env.local` con nuevas credenciales
2. En DevTools → Console (popup):
   ```javascript
   await setupDevConfig();
   ```
3. Recarga la extensión

---

## 🐛 Troubleshooting

### "No hay configuración de Firebase"

**Causa:** Las credenciales no están en chrome.storage

**Solución:**
1. Abre popup
2. Completa el formulario
3. Haz clic "Guardar"
4. Recarga la extensión

### Firebase SDK no se carga

**Causa:** Credenciales no son válidas

**Solución:**
1. Verifica en Firebase Console
2. Copia valores exactos (sin espacios extras)
3. Guarda de nuevo

### Token de autenticación no se guarda

**Causa:** chrome.storage.local no tiene permisos

**Verificar:**
```javascript
// En console del popup
chrome.storage.local.get(['firebaseAuthToken']).then(r => console.log(r));
```

---

## 📚 Archivos Relacionados

- `setup-dev-config.js` - Carga credenciales de `.env.local` en desarrollo
- `firebase-config.js` - Lee de `chrome.storage.sync`
- `background/firebase-popup-auth.js` - Maneja auth y storage de tokens
- `popup-setup.js` - Formulario de configuración
- `.env.local` - Template local con credenciales reales

---

## ✅ Checklist de Configuración

- [ ] Tienes cuenta en Firebase
- [ ] Creaste un proyecto Firebase
- [ ] Registraste una app web en el proyecto
- [ ] Copiaste las credenciales de Firebase Console
- [ ] Completaste el formulario en el popup
- [ ] Hiciste clic en "Guardar Configuración"
- [ ] Recargaste la extensión
- [ ] El popup muestra opciones de login

¡Listo! 🎉
