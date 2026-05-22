# Plan de Optimización Avanzada: Blindaje de Cuotas y Desbloqueo de Calendario

Este documento detalla el plan de acción para implementar los tres bloques de optimización solicitados, garantizando que la lógica actual de inyección en Facebook se mantenga intacta y se mejore el rendimiento global del sistema.

## User Review Required

> [!IMPORTANT]
> **Revisión Requerida - Bloque B (Caché entre perfiles)**:
> Dado que cada perfil de Chrome opera en un entorno de seguridad completamente aislado ("Sandbox"), **una extensión en el Perfil A no puede leer directamente el `chrome.storage` o la memoria caché de una extensión en el Perfil B**.
> Para solucionar esto sin requerir un servidor local, implementaremos el **envío de las imágenes de galería pre-cargadas (en Base64) directamente desde el Dashboard (payload)** hacia la extensión. Como el Dashboard descarga la galería al construir el Preview, puede inyectar los Base64 ligeros (comprimidos previamente) en el mensaje `START_AUTO_FILL`. De esta forma, sin importar en qué perfil se ejecute, **la extensión no realizará NINGUNA petición a Supabase** para descargar imágenes de apoyo. ¿Estás de acuerdo con este enfoque?

## Proposed Changes

---

### Bloque A: Compresión en Cliente y Upload masivo (Acelerar Subidas)

Para lograr que las fotos pasen de 5MB a ~250KB antes de subir a Supabase, interceptaremos los archivos y los redimensionaremos a WebP en el navegador, para luego subirlos en paralelo.

#### [NEW] `src/utils/imageCompressor.ts`
- Se creará un helper ligero que utilice el API nativo de `Canvas` (`createObjectURL`, `Image`, `canvas.toBlob`).
- **Reglas**: Formato `image/webp`, Max Width/Height `1200px`, Calidad `0.75`.

#### [MODIFY] `src/pages/dashboard/Inventory.tsx`
- Refactorizar `handleImageUpload` para usar `imageCompressor` antes de subir.
- Reemplazar el bucle secuencial `for...of` por un array de promesas y `Promise.all()`, permitiendo que si se seleccionan 9 imágenes, las 9 peticiones de subida (ya ultraligeras) salgan y se resuelvan simultáneamente.

#### [MODIFY] `src/pages/dashboard/Galleries.tsx`
- Aplicar la misma refactorización en `handleUpload` usando el compresor WebP y `Promise.all()`.
- Esto hará que la creación de galerías sea instantánea.

---

### Bloque B: Optimización de Tráfico (Blindaje de Egress)

Triplicar perfiles actualmente triplica el Egress porque la extensión de cada perfil vuelve a descargar la galería de Supabase. Lo resolveremos inyectando la caché desde el Dashboard.

#### [MODIFY] `src/pages/dashboard/PublishPreview.tsx` (Preparación de Caché)
- Durante `dispatchToExtension()`, si el producto tiene imágenes de galería, el Dashboard las descargará/convertirá a Base64 y las incluirá directamente en el `automationTask`.
- Al usar imágenes comprimidas en el Bloque A, el tamaño del Payload no será un problema de memoria para el navegador.

#### [MODIFY] `extension/content_script_bridge.js`
- Se ajustará la estructura que recibe `START_AUTO_FILL` para pasar las imágenes Base64 intactas a `chrome.storage.local`.

#### [MODIFY] `extension/modules/automation.js`
- Modificar la función `fetchImageViaBackground` o la lógica de obtención de galerías.
- Si la imagen viene en el payload como Base64 (data URI o blob pre-codificado), **se usará directamente** saltándose la llamada `fetch(url)` hacia Supabase, blindando así el Egress por completo, incluso si publicas en 5 perfiles a la vez.

---

### Bloque C: Desbloqueo de Calendario (Concurrencia de Días en DB)

Evitar que el cambio de días colapse la UI o cruce estados (ej. los logs que llegan del día Jueves actualizan accidentalmente el estado de UI del Viernes).

#### [MODIFY] `src/pages/dashboard/PublishPreview.tsx`
- **Aislamiento de Hooks**: Añadir un guard de seguridad en el `useEffect` que escucha `public-logs` (Supabase Realtime). Solo se incrementará `completedCount` y se actualizará `campaign_executions` si el `product_id` del log pertenece al `selectedDay` actual visible en la UI.
- **Reseteo Atómico**: En el `useEffect` que depende de `selectedDay`, asegurarse de que la inicialización `setExecStatus("idle")` y la cancelación de peticiones anteriores se maneje limpiamente.
- **Doble validación en DB**: En `loadExecution` y `handleStart`, asegurar que las consultas usen `eq('day_of_week', selectedDay)` de forma estricta para evitar sobre-escribir ejecuciones.

## Verification Plan

### Manual Verification
1. Subir 9 fotos pesadas en el inventario: verificar en la pestaña "Red" (Network) de las herramientas de desarrollador que las imágenes suben en paralelo y pesan < 250KB como `image/webp`.
2. Lanzar publicación en 2 perfiles: Verificar en la pestaña "Red" de la extensión de Facebook que **no existen peticiones a la URL del bucket de Supabase** para las imágenes de galería de apoyo (todo debe venir servido por el content_script).
3. Publicar "Jueves" y cambiar la vista a "Viernes" mientras Jueves está corriendo: Verificar que el `completedCount` del viernes no aumenta, y la BD de ejecuciones de viernes se mantiene limpia.
