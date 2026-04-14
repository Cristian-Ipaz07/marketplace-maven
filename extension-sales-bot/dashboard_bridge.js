// ============================================================
// dashboard_bridge.js — Puente entre el Dashboard y la extensión
// Se inyecta SOLO en el Dashboard (localhost / vercel.app)
// ============================================================

console.log('[SalesBot] Bridge inyectado en el Dashboard.');

window.addEventListener('message', (event) => {
  // Seguridad básica: asegurar que viene de la misma ventana
  if (event.source !== window) return;

  const trustedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:8080',
    'https://marketmaster.vercel.app'
  ];

  const isTrusted = trustedOrigins.some(o => event.origin.startsWith(o));
  if (!isTrusted) return;

  // Solo loguear los mensajes relacionados de testing
  if (event.data?.type && typeof event.data.type === 'string' && event.data.type.startsWith('SALESBOT_')) {
     console.log('[SalesBot Bridge] Mansaje recibido del dashboard:', event.data.type, 'Origin:', event.origin);
  }

  // El dashboard pide saber si la extensión está activa
  if (event.data?.type === 'SALESBOT_PING') {
    if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
      console.warn('[SalesBot Bridge] chrome.runtime no está disponible. ¿Se actualizó la extensión sin recargar la página?');
      return;
    }
    
    console.log('[SalesBot Bridge] Recibido PING. Solicitando estado al background...');
    try {
      chrome.runtime.sendMessage({ action: 'SALESBOT_GET_STATUS' }, (response) => {
      // Ignorar lastError si lo hay
      const err = chrome.runtime.lastError;
      if (err) {
         console.warn('[SalesBot Bridge] Error al llamar background:', err);
      }
      
      console.log('[SalesBot Bridge] Respuesta del background:', response);

      if (response && !err) {
        window.postMessage({
          type: 'SALESBOT_PONG',
          hasGroqKey: response.hasGroqKey,
          hasOpenRouterKey: response.hasOpenRouterKey
        }, '*');
      }
    });
    } catch(e) { console.error('Error enviando ping:', e); }
  }

  // El dashboard envía una actualización de config (ej: se presionó "Guardar" o "Sincronizar")
  if (event.data?.type === 'SALESBOT_CONFIG_UPDATE') {
    if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
      console.warn('[SalesBot Bridge] chrome.runtime no está disponible. Por favor, pulsa F5.');
      return;
    }
    
    console.log('[SalesBot Bridge] Recibida actualización de config del dashboard.');
    try {
      chrome.runtime.sendMessage({
      action: 'SALESBOT_SAVE_CONFIG',
      config: event.data.config
    }, (response) => {
      const err = chrome.runtime.lastError;
      if (response?.success && !err) {
        console.log('[SalesBot] Configuración sincronizada desde el dashboard.');
      } else {
        console.warn('[SalesBot] Falló guardado de config en bg:', err);
      }
    });
    } catch(e) { console.error('Error al enviar config:', e); }
  }
});
