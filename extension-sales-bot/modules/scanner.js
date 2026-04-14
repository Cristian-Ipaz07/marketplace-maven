// ============================================================
// modules/scanner.js — Lector de historial unificado
// Soporta Messenger + WhatsApp Web
// ============================================================

window.SalesBotScanner = (() => {
  // ── Tipos de media para WhatsApp ──────────────────────────
  const WA_MEDIA_SELECTORS = {
    audio: 'span[data-icon="audio-file"], span[data-icon="ptt"], span[data-icon="audio"]',
    image: 'img[src*="blob:"], div[style*="background-image"]',
    video: 'span[data-icon="video-pip"], video',
    sticker: 'img[draggable="false"][src*="sticker"]',
    document: 'span[data-icon="doc-generic"], span[data-icon="doc-pdf"]'
  };

  function detectMediaType(el, platform) {
    if (platform !== 'whatsapp') return null;
    const check = (sel) => { try { return el.matches(sel) || !!el.querySelector(sel); } catch { return false; } };
    if (check(WA_MEDIA_SELECTORS.audio)) return '[NOTA_DE_VOZ]';
    if (check(WA_MEDIA_SELECTORS.sticker)) return '[STICKER]';
    if (check(WA_MEDIA_SELECTORS.video)) return '[VIDEO]';
    if (check(WA_MEDIA_SELECTORS.document)) return '[ARCHIVO_ADJUNTO]';
    if (check(WA_MEDIA_SELECTORS.image)) {
      const txt = el.innerText?.replace(/\d{1,2}:\d{2}\s*[ap]\.?m\.?/i, '').trim();
      return txt ? `[IMAGEN: "${txt}"]` : '[IMAGEN]';
    }
    return null;
  }

  // ── Scanner para WhatsApp ─────────────────────────────────
  function scanWhatsApp() {
    const main = document.querySelector('#main');
    if (!main) return [];

    const messages = [];
    const msgEls = main.querySelectorAll('.message-in, .message-out');

    msgEls.forEach(el => {
      const isClient = el.classList.contains('message-in');
      const textEl = el.querySelector('span[data-testid="selectable-text"]');
      const mediaType = detectMediaType(el, 'whatsapp');
      const content = mediaType || textEl?.textContent?.trim() || '';
      if (content) {
        messages.push({ role: isClient ? 'user' : 'assistant', content });
      }
    });

    return messages.slice(-12); // Últimos 12 mensajes
  }

  // ── Scanner para Messenger ────────────────────────────────
  function scanMessenger() {
    const chatArea = document.querySelector('div[role="main"]');
    if (!chatArea) return [];

    try {
      const chatRect = chatArea.getBoundingClientRect();
      const THRESHOLD = chatRect.width * 0.45; // 45%: izquierda = cliente

      // Ignorar textos de UI comunes
      const IGNORED_TEXTS = new Set([
        'Aa', 'Multimedia', 'Archivos', 'Privacidad y ayuda',
        'Visto', 'Entregado', 'Sent', 'Delivered', 'Seen',
        'Reacciona', 'Responder', 'React'
      ]);

      const elements = Array.from(chatArea.querySelectorAll('div[dir="auto"], img[alt]'))
        .filter(el => {
          if (el.tagName === 'IMG') {
            const alt = el.alt || '';
            const isProfile = alt.toLowerCase().includes('perfil') || alt.toLowerCase().includes('profile');
            const isIcon = el.width < 15 || el.height < 15;
            return alt.length > 0 && !isProfile && !isIcon;
          }
          const txt = el.textContent?.trim() || '';
          return txt.length > 0 && !IGNORED_TEXTS.has(txt) && txt.length < 500;
        });

      const rawMsgs = elements.map(el => {
        const rect = el.getBoundingClientRect();
        const isClient = (rect.left - chatRect.left) < THRESHOLD;
        const content = el.tagName === 'IMG' ? `[IMAGEN: "${el.alt}"]` : (el.textContent?.trim() || '');
        return { role: isClient ? 'user' : 'assistant', content, top: rect.top };
      });

      // Ordenar por posición vertical y deduplicar
      const sorted = rawMsgs.sort((a, b) => a.top - b.top);
      const unique = [];
      let lastTop = -9999, lastContent = '';

      for (const msg of sorted) {
        const isDuplicate = Math.abs(msg.top - lastTop) < 10 && msg.content === lastContent;
        if (!isDuplicate) {
          unique.push({ role: msg.role, content: msg.content });
          lastTop = msg.top;
          lastContent = msg.content;
        }
      }

      return unique.slice(-12);
    } catch (e) {
      console.error('[SalesBot Scanner] Error Messenger:', e);
      return [];
    }
  }

  /**
   * Obtiene el historial del chat actual (unificado)
   */
  function getHistory() {
    const platform = window.SalesBotPlatform?.current?.id;
    if (platform === 'whatsapp') return scanWhatsApp();
    if (platform === 'messenger') return scanMessenger();
    return [];
  }

  /**
   * Obtiene el último mensaje del cliente
   */
  function getLastClientMessage() {
    const history = getHistory();
    // Recorrer al revés para encontrar el último mensaje del cliente
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === 'user') return history[i].content;
    }
    return '';
  }

  return { getHistory, getLastClientMessage };
})();
