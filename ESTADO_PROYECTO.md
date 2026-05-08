# 📋 Estado del Proyecto — Market Master (CoverGen Extension)
> Última actualización: 2026-05-08 | Rama activa: `feat-autonomia-total`

---

## 🎯 Objetivo General
Bot de automatización para publicación masiva en **Facebook Marketplace** usando una extensión de Chrome. Funciona con 2 perfiles de la misma cuenta simultáneamente.

---

## ✅ Qué está Funcionando Bien

| Módulo | Estado | Notas |
|---|---|---|
| **Auto-ciclo** | ✅ OK | El bot reinicia solo cada vuelta sin intervención manual |
| **Reutilización de pestaña** | ✅ OK | No abre pestañas nuevas; usa `mm_session` en la URL |
| **Imágenes** | ✅ OK | Carga secuencial con 3 reintentos por imagen; espera visual con MutationObserver |
| **Título / Precio** | ✅ OK | Inyección con `smartFill`, funciona de fondo |
| **Descripción** | ✅ OK | Inyección correcta |
| **Estado (Nuevo)** | ✅ OK | Selector funcional |
| **Categoría** | ✅ OK | Con fallback a "Hogar" si falla la original |
| **Ubicación** | ✅ OK | Busca por barrio primero ("Centro" → selecciona "Centro, Pasto") |
| **Switches Entrega** | ✅ OK | Usa textos exactos de FB: "Encuentro en un lugar público", "Recogida en la puerta", "Entrega en la puerta" |
| **Auto-publicar** | ✅ OK | Click en Siguiente → Publicar → espera redirect → ciclo siguiente |
| **Banner Campaña Finalizada** | ✅ OK | Botón cierra usando `addEventListener` (sin inline onclick que CSP bloquea) |

---

## ⚠️ Problemas Conocidos / Pendientes

### 🔴 Etiquetas (Tags) — Problema Estructural de Chrome
- **Causa raíz identificada**: Chrome bloquea `keydown/keypress/keyup` en pestañas que no están activas (en segundo plano). El campo de tags de Facebook **requiere** estos eventos para crear la "burbuja" del tag.
- **Workaround actual**: Se usa el setter nativo de React (`HTMLTextAreaElement.prototype.value`) + Enter simulado. Funciona cuando la pestaña está activa. En fondo falla.
- **Comportamiento actual**: 1 intento por tag, si no funciona avanza sin bloquear.
- **Sin solución definitiva aún** — Requiere investigar si Chrome Extension APIs permiten enviar eventos a pestañas de fondo con privilegios elevados.

### 🟡 Ubicación — Carga tardía del DOM
- `findInput()` ya tiene retry de 10s (20 intentos × 500ms). Funciona la mayoría del tiempo.
- Si falla: revisar si FB cambió el `aria-label` del campo.

---

## 📁 Archivos Clave de la Extensión

```
extension/
├── content_script_bridge.js     ← Comunicación Dashboard↔FB, banner de estado, auto-trigger por mm_session
├── modules/
│   ├── automation.js            ← FLUJO CENTRAL: fillProduct(), prepareImages(), auto-publicar
│   └── fields/
│       ├── tags.js              ← Inyección de etiquetas (problema de fondo)
│       ├── location.js          ← Campo Ubicación con smart-split barrio/ciudad
│       ├── category.js          ← Selector de categoría con fallback "Hogar"
│       ├── condition.js         ← Campo Estado (Nuevo/Usado)
│       └── delivery.js          ← Switches de preferencias de entrega
```

---

## 🔄 Flujo de Automatización (Completo)

```
Dashboard → "Iniciar Publicación"
    ↓
chrome.storage: guarda task {items[], currentIndex, tabId, profileId}
    ↓
FB: facebook.com/marketplace/create/item?mm_session=SESSION_ID
    ↓
content_script_bridge.js detecta mm_session → dispara fillProduct()
    ↓
automation.js.fillProduct():
  1. prepareImages()     → descarga secuencial con 3 reintentos
  2. injectImagesInstant() → DataTransfer en input[multiple]
  3. Espera carga visual (MutationObserver, máx 30s)
  4. smartFill(Título)
  5. Condition.set("Nuevo")
  6. smartFill(Precio)
  7. Location.set("Centro, Pasto") → tipea barrio → selecciona sugerencia
  8. Description (expandMoreDetails si necesario)
  9. Tags.set([...])     → 1 intento por tag, falla silenciosa
  10. Delivery options   → toggleOptionByName × 4 opciones
  11. Category.set()     → con fallback "Hogar"
  12. VALIDAR (finalTitle, product.price) → aviso en banner si falta
  13. Click "Siguiente" → reintentos de categoría si no aparece
  14. Espera 3s → Click "Publicar"
  15. Espera redirect /marketplace/you/selling (máx 45s)
  16. Log en Supabase (MARKETMASTER_LOG_PUBLICATION)
  17. Notificar Dashboard (STATUS_UPDATE)
  18. Si fin → showFinalCelebration()
  19. Si hay más → window.location = /create/item?mm_session=...
```

---

## 🏗️ Funcionalidad Pendiente de Implementar

### 📸 Galería de Imágenes de Apoyo Compartida
**Qué es**: Módulo para gestionar conjuntos de imágenes reutilizables ("Lociones Hombre", "Chaquetas", etc.).
**Estado**: ✅ **COMPLETADO**.
- La página `/dashboard/galleries` permite gestionar galerías e imágenes (CRUD completo).
- Los productos en el Inventario pueden enlazarse a una galería (el campo `shared_gallery_id` en Supabase se usa para esto).
- El bot (en `automation.js`) carga las imágenes propias del producto y luego añade las de la galería compartida hasta completar el límite de 10 imágenes permitidas por Facebook.

---

## 🗄️ Base de Datos (Supabase)

- Tabla `publication_logs`: registra cada publicación con `product_id`, `cover_id`, `status` ('success'|'error'|'unconfirmed'), `profile_id`
- Tabla `profiles`: perfiles de publicación con `id`, `name`, etc.
- `002_add_profile_executions.sql`: migración pendiente de aplicar

---

## 🔧 Configuración de Automatización (config object)

```js
config = {
  options: ['public_place', 'door_pickup', 'door_delivery', 'hide_friends'],
  selectedCategories: ['Ropa y calzado de hombre'],
  useProductCategory: true,  // false = categoría aleatoria del array
  manualPublish: false,       // DEPRECADO — ahora siempre es automático
}
```

---

## 💡 Notas para Próxima Sesión

1. **Tags en fondo**: La solución real requiere usar la Chrome Extensions API `chrome.debugger` o `chrome.tabs.sendMessage` con permisos de `activeTab` para poder inyectar eventos en pestañas de fondo. Es una refactorización mayor.

2. **Galería de apoyo**: Implementar en `automation.js` que al hacer `prepareImages()`, si el item tiene `gallery_id`, se carguen también las imágenes de esa galería desde Supabase/storage y se concatenen al array de imágenes del producto.

3. **Selector de delivery**: Si Facebook cambia los textos de los switches, actualizar en `automation.js` las líneas 515-519 (los 4 `toggleOptionByName`).
