// ============================================================
// modules/platform.js — Detector de plataforma y selectores
// ============================================================

window.SalesBotPlatform = (() => {
  const hostname = window.location.hostname;
  const isWhatsApp = hostname.includes('whatsapp');
  const isMessenger = hostname.includes('messenger') || hostname.includes('facebook');

  const PLATFORMS = {
    whatsapp: {
      id: 'whatsapp',
      label: 'WhatsApp Web',
      emoji: '🟢',
      color: '#25D366',
      selectors: {
        chatContainer: '#main',
        messageIn: '.message-in',
        messageOut: '.message-out',
        messageText: 'span[data-testid="selectable-text"]',
        chatInput: 'div[contenteditable="true"][data-tab="10"], div[contenteditable="true"][role="textbox"]',
        sendButton: 'button[data-testid="send"], button:has(span[data-icon="wds-ic-send-filled"]), button:has(span[data-icon="send"])',
        contactNameEl: '#main header span[title][dir="auto"], #main header span[dir="auto"]',
        // No hay link de producto en WA, usamos nombre del contacto como clave
        productContextEl: null
      }
    },
    messenger: {
      id: 'messenger',
      label: 'Messenger',
      emoji: '🔵',
      color: '#0099FF',
      selectors: {
        chatContainer: 'div[role="main"]',
        messageIn: null,  // se detecta por posición horizontal
        messageOut: null,
        messageText: 'div[dir="auto"]',
        chatInput: '[role="textbox"][contenteditable="true"], [aria-label="Mensaje"], [aria-label="Message"], [aria-label="Aa"]',
        sendButton: '[aria-label="Enviar"], [aria-label="Send"]',
        contactNameEl: '[aria-label*="Conversación con"], h1, [aria-label*="Conversation with"]',
        // ⭐ AJUSTE #2: Link de producto del Marketplace en el header del chat
        productContextEl: 'a[href*="/marketplace/item/"], [role="link"][href*="marketplace"]'
      }
    }
  };

  const current = isWhatsApp ? PLATFORMS.whatsapp : isMessenger ? PLATFORMS.messenger : null;

  /**
   * Extrae el contexto del producto desde el DOM (Ajuste #2 implementado)
   * Para Messenger: busca el link del item de Marketplace en el header del chat
   * Para WhatsApp: retorna el nombre del contacto como clave de búsqueda
   */
  function extractProductContext() {
    if (!current) return null;

    if (current.id === 'messenger') {
      try {
        // En Messenger, el link al producto de Marketplace contiene la info real
        const links = document.querySelectorAll(current.selectors.productContextEl);
        for (const link of links) {
          const container = link.closest('[role="row"], [class*="thread"]') || link.parentElement;
          const text = container?.innerText?.trim();
          if (!text) continue;
          
          // Buscar la línea que tiene el símbolo de moneda ($)
          const lines = text.split('\n');
          const priceLine = lines.find(l => l.includes('$'));
          
          if (priceLine) {
            // El formato de Facebook ahora es: "$ 85 000 - Chaqueta Impermeable..." o "$85.000 · Chaqueta..."
            // Puede usar guion normal (-), guion largo (–), o punto medio (·)
            const sepRegex = /\s*[-–·]\s*/;
            const parts = priceLine.split(sepRegex);
            
            if (parts.length >= 2) {
              const price = parts[0].trim();
              const product = parts.slice(1).join(' - ').trim();
              return { type: 'product_link', value: product, price: price, raw: link.href };
            }
          }
        }

        // Fallback: buscar título de producto genérico si no hay link (restringido a chat activo)
        const mainArea = document.querySelector('div[role="main"]');
        if (mainArea) {
          const specificSelectors = ['.x1dyh7pn', '.x1j85h84', '[class*="thread"] span'];
          for (const sel of specificSelectors) {
            const els = mainArea.querySelectorAll(sel);
            for (const el of els) {
              const txt = el.innerText?.trim();
              if (!txt || txt.length < 3 || txt.length > 150) continue;
              
              if (txt.includes('$') && (txt.includes(' - ') || txt.includes(' – ') || txt.includes(' · '))) {
                 const sepRegex = /\s*[-–·]\s*/;
                 const parts = txt.split(sepRegex);
                 return { type: 'dom_extracted', value: parts.slice(1).join(' - ').trim(), price: parts[0].trim() };
              }
            }
          }
        }
      } catch (e) {
        console.error('[SalesBot Context]', e);
      }
    }

    if (current.id === 'whatsapp') {
      // Para WA: el nombre del contacto es la "clave" en Supabase para recordar producto
      try {
        const nameEl = document.querySelector(current.selectors.contactNameEl);
        const name = (nameEl?.getAttribute('title') || nameEl?.textContent || '').trim();
        if (name && name !== 'default' && !name.includes('Grupo')) {
          return { type: 'contact_key', value: name };
        }
      } catch (e) { /* Silent fail */ }
    }

    return null;
  }

  /**
   * Extrae el nombre del contacto del DOM
   */
  function getContactName() {
    if (!current) return '';
    try {
      if (current.id === 'messenger') {
         let title = document.title;
         title = title.replace(/^\(\d+\)\s*/, ''); // (2) Messenger
         if (title.includes(' | ')) title = title.split(' | ')[0];
         if (title.includes(' - ')) title = title.split(' - ')[0];
         if (title && title !== 'Messenger' && title !== 'Facebook' && title !== 'Marketplace' && title !== 'Chats') {
            return title.trim().split(' ')[0];
         }
         
         // Fallback nuevo para Facebook: Leer el encabezado superior del chat activo
         // Restringimos a role="main" para evitar atrapar nombres del sidebar (lista de chats)
         const mainArea = document.querySelector('div[role="main"]');
         if (mainArea) {
            const headerEls = mainArea.querySelectorAll('span[dir="auto"], h1 span');
            for (const el of headerEls) {
               const txt = el.textContent.trim();
               // Buscamos patrones "Nombre - Producto" o "Nombre · Producto"
               if (txt.includes(' - ') || txt.includes(' · ') || txt.includes(' – ')) {
                  const parts = txt.split(/\s*[-·–]\s*/);
                  if (parts[0] && parts[0].length < 20 && !parts[0].includes('$')) {
                     return parts[0].trim().split(' ')[0]; // Solo el primer nombre
                  }
               }
            }
         }
      }

      const el = document.querySelector(current.selectors.contactNameEl);
      if (!el) return '';
      const name = (el.getAttribute('title') || el.textContent || '').trim();
      const ignored = ['default', 'new_chat', 'Conversación con', 'Conversation with', 'Chats', 'Marketplace'];
      if (ignored.some(i => name === i || name.includes(i))) return '';
      return name.split(' ')[0]; 
    } catch { return ''; }
  }

  /**
   * Obtiene el input de texto activo del chat
   */
  function getChatInput() {
    if (!current) return null;
    const selectors = current.selectors.chatInput.split(', ');
    for (const sel of selectors) {
      const el = document.querySelector(sel.trim());
      if (el) return el;
    }
    return null;
  }

  /**
   * Obtiene el botón de enviar
   */
  function getSendButton() {
    if (!current) return null;
    try {
      return document.querySelector(current.selectors.sendButton);
    } catch { return null; }
  }

  return {
    current,
    isWhatsApp,
    isMessenger,
    PLATFORMS,
    extractProductContext,
    getContactName,
    getChatInput,
    getSendButton
  };
})();
