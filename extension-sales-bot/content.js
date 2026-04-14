// ============================================================
// content.js — Entry point del content script
// Inicializa todos los módulos en orden correcto
// ============================================================

(function () {
  'use strict';

  // Verificar que estamos en una plataforma soportada
  const platform = window.SalesBotPlatform?.current;
  if (!platform) {
    console.log('[SalesBot] Plataforma no soportada:', window.location.hostname);
    return;
  }

  console.log(`[SalesBot] Inicializando en ${platform.label}…`);

  // Todos los módulos se cargan como content_scripts en orden definido en manifest.json
  // platform.js → scanner.js → ai_client.js → inserter.js → ui.js → content.js

  let initialized = false;

  function initialize() {
    if (initialized) return;

    // Verificar que todos los módulos están disponibles
    if (
      !window.SalesBotPlatform ||
      !window.SalesBotScanner ||
      !window.SalesBotAI ||
      !window.SalesBotInserter ||
      !window.SalesBotUI
    ) {
      console.warn('[SalesBot] Módulos no cargados aún, reintentando…');
      return;
    }

    initialized = true;

    // Iniciar el panel UI (que internamente espera el DOM)
    window.SalesBotUI.init();

    // Bridge: escuchar mensajes desde el dashboard (extensión → content → background)
    window.addEventListener('message', (event) => {
      // Seguridad: solo aceptar mensajes de orígenes conocidos
      const trustedOrigins = [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://marketmaster.vercel.app'
      ];

      const isTrusted = trustedOrigins.some(o => event.origin.startsWith(o))
        || event.origin.startsWith('chrome-extension://');

      if (!isTrusted) return;

      if (event.data?.type === 'SALESBOT_CONFIG_UPDATE') {
        chrome.runtime.sendMessage({
          action: 'SALESBOT_SAVE_CONFIG',
          config: event.data.config
        }, (response) => {
          if (response?.success) {
            console.log('[SalesBot] Config sincronizada desde dashboard');
            // Limpiar cache de inventario para que use las nuevas credenciales
            window.SalesBotAI?.clearInventoryCache?.();
          }
        });
      }
    });

    // Bridge inverso: el background puede enviar mensajes al content
    chrome.runtime.onMessage.addListener((request) => {
      if (request.action === 'SALESBOT_STATUS_CHECK') {
        return { alive: true, platform: platform.id };
      }
    });

    console.log('[SalesBot] ✅ Inicialización completa en', platform.label);
  }

  // Intentar inicializar inmediatamente y con reintentos
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initialize();
  } else {
    document.addEventListener('DOMContentLoaded', initialize);
  }

  // Reintentos para SPAs que cargan contenido dinámicamente
  let retries = 0;
  const retryTimer = setInterval(() => {
    if (initialized || retries++ > 20) {
      clearInterval(retryTimer);
      return;
    }
    initialize();
  }, 500);

})();
