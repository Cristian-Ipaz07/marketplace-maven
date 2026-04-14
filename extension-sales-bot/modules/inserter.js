// ============================================================
// modules/inserter.js — Inserción de texto robusta con
// Shadow Loop de humanización (Ajuste #3)
// ============================================================

window.SalesBotInserter = (() => {

  // ── Helpers de humanización ───────────────────────────────

  /** Retardo aleatorio entre min y max ms */
  function randomDelay(min = 300, max = 1200) {
    return new Promise(resolve => setTimeout(resolve, min + Math.random() * (max - min)));
  }

  /** Retardo variable adaptativo basado en longitud del mensaje */
  function humanDelay(text) {
    // Simula velocidad de escritura: ~200 chars/segundo como mínimo
    const baseDelay = 500;
    const charDelay = Math.min(text.length * 8, 2500); // caps at 2.5s
    const jitter = Math.random() * 400;
    return new Promise(resolve => setTimeout(resolve, baseDelay + charDelay + jitter));
  }

  // ── Estrategias de inserción ──────────────────────────────

  /**
   * Estrategia A: input/textarea nativo
   */
  function insertStrategyA(el, text) {
    if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return false;
    try {
      el.focus();
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(el, text);
      } else {
        el.value = text;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch { return false; }
  }

  /**
   * Estrategia B: contentEditable con Shadow Loop completo (Ajuste #3)
   * Emula la latencia de un humano real: foco → keydown → input → chunks
   */
  async function insertStrategyB(el, text) {
    if (!el.isContentEditable && el.contentEditable !== 'true') return false;
    try {
      el.focus();
      await randomDelay(80, 180); // Pequeña pausa post-foco

      // Limpiar contenido previo
      el.textContent = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));

      // Dividir en chunks si el mensaje es largo (>80 chars → 2-3 bloques)
      const chunks = splitIntoChunks(text);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        // Disparar keydown antes de insertar (simula presión de tecla)
        el.dispatchEvent(new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key: chunk[0] || 'a',
          code: 'KeyA'
        }));

        // Insertar chunk con execCommand (más compatible con React/Vue)
        const inserted = document.execCommand('insertText', false, chunk);

        if (!inserted) {
          // Fallback: Range API
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
          const textNode = document.createTextNode(chunk);
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          selection.removeAllRanges();
          selection.addRange(range);
        }

        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

        // Pausa entre chunks (200-400ms) para emular latencia de red humana
        if (i < chunks.length - 1) {
          await randomDelay(200, 400);
        }
      }

      return el.textContent.length > 0 || el.innerText?.length > 0;
    } catch { return false; }
  }

  /**
   * Estrategia C: Range API directa (último recurso)
   */
  function insertStrategyC(el, text) {
    try {
      el.focus();
      const selection = window.getSelection();
      if (!selection) return false;
      selection.removeAllRanges();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      selection.addRange(range);
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    } catch { return false; }
  }

  // ── Chunker de texto ──────────────────────────────────────

  /**
   * Divide el texto en 1-3 bloques naturales (en puntuación o palabras)
   * para textos largos (>80 chars)
   */
  function splitIntoChunks(text) {
    if (text.length <= 80) return [text];

    // Intentar dividir en oraciones
    const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];

    if (sentences.length >= 2) {
      // Máximo 3 chunks
      if (sentences.length === 2) return sentences;
      const mid = Math.ceil(sentences.length / 2);
      return [
        sentences.slice(0, mid).join(' '),
        sentences.slice(mid).join(' ')
      ].filter(s => s.trim());
    }

    // Si no hay puntuación, dividir en palabras
    const words = text.split(' ');
    const half = Math.ceil(words.length / 2);
    return [
      words.slice(0, half).join(' '),
      words.slice(half).join(' ')
    ].filter(s => s.trim());
  }

  // ── API pública ───────────────────────────────────────────

  /**
   * Inserta texto en el input del chat con humanización completa
   * @param {string} text - Texto a insertar
   * @param {boolean} autoSend - Si es true, envía el mensaje automáticamente
   * @param {Object} options - {delayMs: número base de delay}
   * @returns {Promise<{success: boolean, strategy: string}>}
   */
  async function insertText(text, autoSend = false, options = {}) {
    const platform = window.SalesBotPlatform;
    const input = platform?.getChatInput();

    if (!input) {
      return { success: false, error: 'No se encontró el input del chat' };
    }

    // ── Fase 1: Delay humanizador ANTES de escribir ─────────
    await humanDelay(text);

    // ── Fase 2: Intentar estrategias en orden ───────────────
    let success = false;
    let strategyUsed = '';

    if (insertStrategyA(input, text)) {
      success = true;
      strategyUsed = 'A-native';
    } else {
      success = await insertStrategyB(input, text);
      strategyUsed = success ? 'B-contenteditable' : 'C-range';
      if (!success) {
        success = insertStrategyC(input, text);
      }
    }

    if (!success) {
      return { success: false, error: 'Todas las estrategias de inserción fallaron' };
    }

    // ── Fase 3: Auto-send si está habilitado ────────────────
    if (autoSend) {
      await randomDelay(300, 700); // Pausa antes de enviar (humano revisa)

      const sendBtn = platform?.getSendButton();
      if (sendBtn) {
        sendBtn.click();
      } else {
        // Fallback: Enter key
        input.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          bubbles: true,
          cancelable: true
        }));
        input.dispatchEvent(new KeyboardEvent('keyup', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          bubbles: true
        }));
      }
    }

    return { success: true, strategy: strategyUsed };
  }

  /**
   * Verifica si el input está disponible y accesible
   */
  function isInputAvailable() {
    const input = window.SalesBotPlatform?.getChatInput();
    return !!input && !input.disabled && !input.readOnly;
  }

  return { insertText, isInputAvailable, splitIntoChunks };
})();
