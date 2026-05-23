# 📋 Estado del Proyecto — Market Master (CoverGen Extension)
> Última actualización: 2026-05-22 | Rama activa: `feat-autonomia-total`

---

## 🎯 Objetivo General
Bot de automatización para publicación masiva en **Facebook Marketplace** usando una extensión de Chrome. Funciona con 2 perfiles de la misma cuenta simultáneamente.

---

## ✅ Qué está Funcionando Bien

| Módulo | Estado | Notas |
|---|---|---|
| **Auto-ciclo** | ✅ OK | El bot reinicia solo cada vuelta sin intervención manual |
| **Reutilización de pestaña** | ✅ OK | No abre pestañas nuevas; usa `mm_session` en la URL |
| **Conversión WebP en Cliente** | ✅ OK | Compresión robusta mediante canvas en cliente. Los eventos de carga se definen antes de `img.src` para evitar omisiones de eventos. |
| **Aislamiento Multitarea** | ✅ OK | Subida de portadas con inputs dinámicos en memoria. Permite subir fotos el martes, cambiar de pestaña de forma inmediata y subir el miércoles concurrentemente sin colisiones de estado. |
| **Optimización de Egress (Caché)** | ✅ OK | Caché global en memoria de Base64 para imágenes de galería y portadas. Evita descargas duplicadas de Supabase Storage en campañas repetidas o multi-perfil. |
| **Recolección de Basura física** | ✅ OK | Eliminación de un producto en Inventario borra físicamente de forma automática todas sus portadas asociadas en el bucket `daily-covers`. |
| **Imágenes en Extensión** | ✅ OK | Carga secuencial con 3 reintentos por imagen; espera visual con MutationObserver |
| **Título / Precio** | ✅ OK | Inyección con `smartFill`, funciona de fondo |
| **Descripción** | ✅ OK | Inyección correcta |
| **Estado (Nuevo)** | ✅ OK | Selector funcional |
| **Categoría** | ✅ OK | Búsqueda global robusta en todo el DOM (`[role="option"]`) con texto flexible y pausa para corrección manual |
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

## 📁 Archivos Clave de la Extensión y Aplicación

```
src/
├── pages/dashboard/
│   ├── DailyCovers.tsx          ← Portadas Diarias: subidas aisladas por target y compresión en paralelo
│   ├── Inventory.tsx            ← Inventario: CRUD de productos, subida WebP y Garbage Collector en delete
│   ├── Galleries.tsx            ← Galerías de apoyo: CRUD completo y subida optimizada
│   └── PublishPreview.tsx       ← Vista previsualización: inyección de Base64 a extensión con caché local
├── utils/
│   └── imageCompressor.ts       ← Helper de canvas: compresión robusta a WebP
extension/
├── content_script_bridge.js     ← Comunicación Dashboard↔FB, banner de estado, auto-trigger por mm_session
├── modules/
│   ├── automation.js            ← FLUJO CENTRAL: fillProduct(), prepareImages(), auto-publicar
│   └── fields/
│       ├── tags.js              ← Inyección de etiquetas (problema de fondo)
```

---

## 🔄 Flujo de Automatización (Completo)

```
Dashboard → "Iniciar Publicación"
    ↓
Carga de imágenes del día desde Supabase → Conversión a Base64 usando caché (urlToBase64)
    ↓
chrome.storage: guarda task {items[], currentIndex, tabId, profileId} (con imágenes ya en Base64 para Cero Egress)
    ↓
FB: facebook.com/marketplace/create/item?mm_session=SESSION_ID
    ↓
content_script_bridge.js detecta mm_session → dispara fillProduct()
    ↓
automation.js.fillProduct():
  1. prepareImages()     → carga instantánea de Base64 almacenados en local storage (cero consumo de red de Supabase)
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

## 🏗️ Optimizaciones Recientes Implementadas (Blindaje de Supabase Plan Free)

### 1. Conversión de Mime-Type e Inferencia de WebP
- Corregido el bug del listener de carga en `imageCompressor.ts` asignando `onload`/`onerror` antes de `src`.
- Configurado `{ contentType: "image/webp", upsert: true }` explícitamente en todas las subidas para asegurar almacenamiento optimizado en Supabase Storage.

### 2. Recolección de Basura de Almacenamiento
- Al eliminar un producto, todas las portadas en el bucket `daily-covers` asociadas a este producto se eliminan físicamente de manera proactiva.

### 3. Caché de Base64 local (Dashboard)
- Evita descargas redundantes de imágenes por cada ejecución de campaña, protegiendo la cuota mensual de 5GB de Egress/Cache egress del plan gratuito.

### 4. Búsqueda Robusta de Categoría y Estado
- Refactorizado el módulo de `category.js` para usar un motor de búsqueda global en el DOM. En lugar de limitarse a un contenedor "listbox/dialog" que puede variar o seleccionar componentes equivocados (por el Virtual DOM de FB), busca activamente todos los elementos `[role="option"]` visibles en pantalla de manera iterativa.
- Normalización avanzada de strings (eliminación de acentos y consideración de textos inyectados como "Envío disponible").
- El módulo de Estado (`condition.js`) ahora lee dinámicamente la configuración proveniente del producto (`Usado - Como nuevo`, etc.) en lugar de inyectar siempre "Nuevo".
- Loop de pausa inteligente: si una categoría falla por alguna razón externa, el bot se pausa vigilando el botón "Siguiente", permitiendo corrección manual sin cancelar la automatización.

---

## 🗄️ Base de Datos (Supabase)

- Tabla `publication_logs`: registra cada publicación con `product_id`, `cover_id`, `status` ('success'|'error'|'unconfirmed'), `profile_id`
- Tabla `profiles`: perfiles de publicación con `id`, `name`, etc.
- Tabla `daily_covers`: mapea las portadas de calendario asignadas a productos por día.
- Tabla `shared_gallery_images`: imágenes asociadas a galerías compartidas.
- Tabla `products`: inventario con campo `shared_gallery_id`.
